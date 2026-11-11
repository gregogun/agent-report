import { z } from "zod";
import { ANCHORS, registry } from "./blocks.js";
import { frontmatter } from "./index.js";

type JsonSchema = {
	type?: string;
	enum?: string[];
	pattern?: string;
	description?: string;
	default?: unknown;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	items?: JsonSchema;
};

const objectSchema = (schema: z.ZodObject): JsonSchema => z.toJSONSchema(schema, { io: "input" }) as JsonSchema;

function typeOf(s: JsonSchema): string {
	if (s.enum) return `one of ${s.enum.map((v) => `\`${v}\``).join(", ")}`;
	if (s.type === "array" && s.items?.properties) return "list of objects";
	return s.type ?? "any";
}

function propRows(schema: z.ZodObject, keyHeading: string): string[] {
	const json = objectSchema(schema);
	const entries = Object.entries(json.properties ?? {});
	if (!entries.length) return [];
	const required = new Set(json.required ?? []);
	const rows = [`| ${keyHeading} | type | required | description |`, "| --- | --- | --- | --- |"];
	for (const [name, s] of entries) {
		rows.push(`| \`${name}\` | ${typeOf(s)} | ${required.has(name) ? "yes" : "no"} | ${s.description ?? ""} |`);
		for (const [child, c] of Object.entries(s.items?.properties ?? {})) {
			const req = (s.items?.required ?? []).includes(child) ? "yes" : "no";
			rows.push(`| \`${name}[].${child}\` | ${typeOf(c)} | ${req} | ${c.description ?? ""} |`);
		}
	}
	return rows;
}

function blockSection(kind: keyof typeof registry): string[] {
	const e = registry[kind];
	const props = propRows(e.props, "prop");
	const body = e.bodySchema ? propRows(e.bodySchema, "key") : [];
	return [
		`## \`${kind}\``,
		"",
		e.summary,
		"",
		props.length ? "Props go on the opening fence line, as `key=value` or `key=\"value with spaces\"`." : "No props.",
		...(props.length ? ["", ...props] : []),
		"",
		`Body: ${e.body}`,
		...(body.length ? ["", ...body] : []),
		"",
		"Example:",
		"",
		"````markdown",
		e.example,
		"````",
		"",
	];
}

export function formatReference(): string {
	const lines = [
		"# agent-report format reference",
		"",
		"A report is one Markdown file. It is a tree of blocks. `agent-report build <report.md>` turns it into a single HTML file.",
		"",
		"## Frontmatter",
		"",
		"The file starts with a `---` YAML block. Both keys are required and no other keys are allowed.",
		"",
		...propRows(frontmatter, "key"),
		"",
		"```markdown",
		"---",
		"version: 1",
		"title: Add session expiry",
		"---",
		"```",
		"",
		"## Prose",
		"",
		"Plain Markdown between blocks is prose. GitHub-flavored Markdown is supported. A fenced code block is a block only when its language is one of the block names below. Any other fence is ordinary code.",
		"",
		`Block names: ${Object.keys(registry)
			.map((k) => `\`${k}\``)
			.join(", ")}.`,
		"",
		"A block is a fenced code block. The fence language is the block name, the props follow it on the same line, and the body is between the fences.",
		"",
		...Object.keys(registry).flatMap((k) => blockSection(k as keyof typeof registry)),
		"## Diff annotation anchors",
		"",
		"An annotation in a `diff` body starts a line with `@`, then an anchor, then a space and the text. The anchor picks the diff line the note attaches to.",
		"",
		"| anchor | meaning |",
		"| --- | --- |",
		...ANCHORS.map((a) => `| \`${a.form}\` | ${a.meaning} |`),
		"",
		'Line numbers are 1-based file line numbers on that side, not positions in the diff. Every anchored line must be visible in the diff block, so within the selected `hunks`. A range must not end before it starts. A quoted anchor is a substring match over the visible lines on that side and must match exactly one line, so quote enough of the line to be unique. Escape a double quote inside quotes as `\\"`. Added lines exist only on the new side, removed lines only on the old side, and context lines on both.',
		"",
	];
	return lines.join("\n");
}
