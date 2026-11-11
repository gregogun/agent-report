import { z } from "zod";
import { problemsFromZod, yamlStyle } from "./issues.js";
import { parseMarkdown } from "./markdown.js";
import type { Annotation, AnnotationAnchor, Block, BlockType, Diagnostic, LineRange, Markdown, Result } from "./types.js";
import { readYaml } from "./yaml.js";

export type BlockKind = Exclude<BlockType, "prose">;

type Fields<K extends BlockKind> = K extends unknown ? Omit<Extract<Block, { type: K }>, "type" | "position"> : never;

export type BodyContext = {
	/* Maps a 1-based line within the body to its line in the report. */
	lineAt(line: number): number;
	column: number;
};

export type BlockEntry<K extends BlockKind, P extends z.ZodObject, B> = {
	props: P;
	parseBody(body: string, ctx: BodyContext): Result<B>;
	assemble(props: z.output<P>, body: B): Fields<K>;
	summary: string;
	example: string;
};

const entry =
	<K extends BlockKind>() =>
	<P extends z.ZodObject, B>(e: BlockEntry<K, P, B>) =>
		e;

const fail = (diagnostics: Diagnostic[]): { ok: false; diagnostics: Diagnostic[] } => ({ ok: false, diagnostics });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const diag = (ctx: BodyContext, line: number, message: string, hint?: string): Diagnostic => ({
	position: { line: ctx.lineAt(line), column: ctx.column },
	message,
	...(hint ? { hint } : {}),
});

const ANCHOR_FORMS = '@new:42, @new:57-61, @old:12, @"quoted code" (side defaults to new), @old:"quoted code"';

const LINES = /^(old|new):(\d+)(?:-(\d+))?/;
const TEXT = /^(?:(old|new):)?"((?:[^"\\]|\\.)*)"/;

function parseAnchor(rest: string): { anchor: AnnotationAnchor; text: string } | { error: string; hint?: string } {
	const badForms = { error: `invalid annotation anchor "@${rest.split(/\s/)[0]}"`, hint: `accepted anchors: ${ANCHOR_FORMS}` };
	const lines = LINES.exec(rest);
	if (lines) {
		const after = rest.slice(lines[0].length);
		if (after && !/^\s/.test(after)) return badForms;
		const start = Number(lines[2]);
		const end = lines[3] === undefined ? start : Number(lines[3]);
		if (start < 1) return { error: "annotation line numbers start at 1", hint: "use @new:1 for the first line" };
		if (end < start) return { error: `annotation line range ${start}-${end} ends before it starts`, hint: `write @${lines[1]}:${end}-${start}` };
		return { anchor: { kind: "lines", side: lines[1] as "old" | "new", lines: { start, end } }, text: after.trim() };
	}
	const text = TEXT.exec(rest);
	if (text) {
		const after = rest.slice(text[0].length);
		if (after && !/^\s/.test(after)) return badForms;
		const quoted = (text[2] as string).replace(/\\(["\\])/g, "$1");
		if (!quoted) return { error: "annotation anchor quotes no code", hint: 'put the code to anchor to between the quotes, like @"token.expires"' };
		return { anchor: { kind: "text", side: (text[1] as "old" | "new" | undefined) ?? "new", text: quoted }, text: after.trim() };
	}
	return badForms;
}

const rangeOf = (value: string): LineRange => {
	const [start, end] = value.split("-").map(Number) as [number, number | undefined];
	return { start, end: end ?? start };
};

const diff = entry<"diff">()({
	props: z.strictObject({
		range: z.string().min(1).describe("git range, like main..HEAD"),
		path: z.string().min(1).describe("file path relative to the repo root"),
		hunks: z
			.string()
			.regex(/^[1-9]\d*(-[1-9]\d*)?$/, "must be N or N-M with 1-based hunk numbers, like 2 or 2-3")
			.refine((v) => rangeOf(v).start <= rangeOf(v).end, "range ends before it starts")
			.transform(rangeOf)
			.optional(),
	}),
	parseBody(body, ctx) {
		const diagnostics: Diagnostic[] = [];
		type Draft = { anchor: AnnotationAnchor; text: string[]; line: number };
		const drafts: Draft[] = [];
		body.split("\n").forEach((raw, i) => {
			const line = i + 1;
			const text = raw.trimEnd();
			if (!text.trim()) return;
			if (text.startsWith("@")) {
				const parsed = parseAnchor(text.slice(1));
				if ("error" in parsed) {
					diagnostics.push(diag(ctx, line, parsed.error, parsed.hint));
					drafts.push({ anchor: { kind: "lines", side: "new", lines: { start: 1, end: 1 } }, text: ["x"], line });
					return;
				}
				drafts.push({ anchor: parsed.anchor, text: parsed.text ? [parsed.text] : [], line });
				return;
			}
			const current = drafts[drafts.length - 1];
			if (!current) {
				diagnostics.push(diag(ctx, line, "diff body has text before the first annotation", `start each annotation with an anchor: ${ANCHOR_FORMS}`));
				return;
			}
			current.text.push(text);
		});
		for (const draft of drafts) {
			if (!draft.text.length) {
				diagnostics.push(diag(ctx, draft.line, "annotation has no text after its anchor", "write the annotation after the anchor, like @new:42 Why this changed"));
			}
		}
		if (diagnostics.length) return fail(diagnostics);
		return ok(
			drafts.map(
				(d): Annotation => ({
					anchor: d.anchor,
					body: parseMarkdown(d.text.join("\n")),
					position: { line: ctx.lineAt(d.line), column: ctx.column },
				}),
			),
		);
	},
	assemble: (props, annotations) => ({
		range: props.range,
		path: props.path,
		hunks: props.hunks ?? null,
		annotations,
	}),
	summary: "A git diff of one file with annotations anchored to lines or code text.",
	example: [
		"```diff range=main..HEAD path=src/auth.ts hunks=1-2",
		"@new:42 Why this check moved up.",
		"@new:57-61 A range of lines. The annotation can",
		"continue on the next line, and use **markdown**.",
		"@old:12 The guard this change removes.",
		'@"token.expires" Anchor to code text. Side defaults to new.',
		'@old:"legacyLogin()" Anchor to code text on the old side.',
		"```",
	].join("\n"),
});

const CALLOUT_KINDS = ["note", "concept", "edge-case", "warning"] as const;

const callout = entry<"callout">()({
	props: z.strictObject({
		kind: z.enum(CALLOUT_KINDS).describe(CALLOUT_KINDS.join(" | ")),
		title: z.string().optional(),
	}),
	parseBody(body, ctx) {
		if (!body.trim()) return fail([diag(ctx, 1, "callout body is empty", "write the callout text as markdown between the fences")]);
		return ok(parseMarkdown(body));
	},
	assemble: (props, body) => ({ kind: props.kind, title: props.title ?? null, body }),
	summary: "A highlighted aside. Kinds: note, concept, edge-case, warning.",
	example: ['```callout kind=warning title="Migration order"', "Run the **schema** migration before deploying.", "```"].join("\n"),
});

const decisionBody = z.strictObject({
	chosen: z.string().min(1).describe("the option you chose"),
	why: z.string().min(1).describe("why you chose it"),
	alternatives: z
		.array(
			z.strictObject({
				option: z.string().min(1).describe("an option you rejected"),
				reason: z.string().min(1).describe("why you rejected it"),
			}),
		)
		.default([]),
});

const decision = entry<"decision">()({
	props: z.strictObject({ title: z.string().min(1).describe("the question this decision answers") }),
	parseBody(body, ctx) {
		const read = readYaml(body, ctx.lineAt(1), "decision body");
		if (read.errors.length) return fail(read.errors);
		const parsed = decisionBody.safeParse(read.value);
		if (!parsed.success) {
			return fail(
				problemsFromZod(parsed.error, read.value, decisionBody, yamlStyle("decision body")).map((p) => ({
					position: { line: read.lineOf(p.path), column: ctx.column },
					message: p.message,
					...(p.hint ? { hint: p.hint } : {}),
				})),
			);
		}
		const { chosen, why, alternatives } = parsed.data;
		return ok({
			chosen: parseMarkdown(chosen),
			why: parseMarkdown(why),
			alternatives: alternatives.map((a) => ({ option: a.option, reason: parseMarkdown(a.reason) })),
		});
	},
	assemble: (props, body) => ({ title: props.title, ...body }),
	summary: "A design decision: what was chosen, why, and the alternatives rejected. Body is YAML.",
	example: [
		'```decision title="Where to store sessions"',
		"chosen: Redis",
		"why: Sessions expire, and Redis expires keys natively.",
		"alternatives:",
		"  - option: Postgres",
		"    reason: Needs a cleanup job for expired rows.",
		"```",
	].join("\n"),
});

const reviewChecklist = entry<"review-checklist">()({
	props: z.strictObject({}),
	parseBody(body, ctx) {
		const nodes = parseMarkdown(body);
		const first = nodes[0];
		if (nodes.length !== 1 || first?.type !== "list") {
			const line = first?.position?.start.line ?? 1;
			return fail([diag(ctx, line, "review-checklist body must be a markdown list and nothing else", "write one item per line, like - Check the migration is reversible")]);
		}
		return ok(first.children.map((item): Markdown => item.children));
	},
	assemble: (_props, items) => ({ items }),
	summary: "Things the reviewer should check. Body is a markdown list.",
	example: ["```review-checklist", "- Check the migration is reversible", "- Confirm **auth** still rejects expired tokens", "```"].join("\n"),
});

export const registry = { diff, callout, decision, "review-checklist": reviewChecklist } satisfies {
	[K in BlockKind]: BlockEntry<K, z.ZodObject, any>;
};

export type AnyEntry = BlockEntry<BlockKind, z.ZodObject, any>;
