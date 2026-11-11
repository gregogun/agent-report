import type { Code, RootContent } from "mdast";
import { z } from "zod";
import { findHeadings, indexHeadings } from "./headings.js";
import { type AnyEntry, type BlockKind, registry } from "./blocks.js";
import { problemsFromZod, propStyle, yamlStyle } from "./issues.js";
import { parseReportTree } from "./markdown.js";
import { tokenizeProps } from "./props.js";
import type { Block, Diagnostic, HeadingIndex, Report, Result } from "./types.js";
import { readYaml } from "./yaml.js";

export { findHeadings, plainText } from "./headings.js";
export type * from "./types.js";

export const frontmatter = z.object({
	version: z
		.number()
		.refine((v) => v === 1, {
			error: (issue) => `unsupported format version ${String(issue.input)}`,
			params: { hint: "set version: 1, the only format version this build reads" },
		})
		.describe("format version, must be 1"),
	title: z.string().min(1).describe("report title"),
});

const isBlockKind = (lang: string | null | undefined): lang is BlockKind => !!lang && Object.hasOwn(registry, lang);

function parseFrontmatter(node: RootContent | undefined, diagnostics: Diagnostic[]): { title: string } | null {
	if (node?.type !== "yaml") {
		diagnostics.push({
			position: { line: 1, column: 1 },
			message: "report is missing its frontmatter",
			hint: "start the report with a --- block containing version: 1 and title: <report title>",
		});
		return null;
	}
	const read = readYaml(node.value, (node.position?.start.line ?? 1) + 1, "frontmatter");
	if (read.errors.length) {
		diagnostics.push(...read.errors);
		return null;
	}
	const parsed = frontmatter.safeParse(read.value);
	if (parsed.success) return parsed.data;
	for (const p of problemsFromZod(parsed.error, read.value, frontmatter, yamlStyle("frontmatter"))) {
		diagnostics.push({
			position: { line: read.lineOf(p.path), column: 1 },
			message: p.message,
			...(p.hint ? { hint: p.hint } : {}),
		});
	}
	return null;
}

function parseFence(node: Code, kind: BlockKind, diagnostics: Diagnostic[]): Block | null {
	const entry: AnyEntry = registry[kind];
	const fence = { line: node.position?.start.line ?? 1, column: node.position?.start.column ?? 1 };
	const at = (message: string, hint?: string): Diagnostic => ({ position: fence, message, ...(hint ? { hint } : {}) });
	const tokens = tokenizeProps(node.meta ?? "", kind);
	const style = propStyle(kind);
	const problems = [...tokens.problems];
	const props = entry.props.safeParse(tokens.props);
	if (!props.success) problems.push(...problemsFromZod(props.error, tokens.props, entry.props, style));
	for (const p of problems) diagnostics.push(at(p.message, p.hint));

	const body = entry.parseBody(node.value, { lineAt: (line) => fence.line + line, column: fence.column });
	if (!body.ok) diagnostics.push(...body.diagnostics);
	if (problems.length || !props.success || !body.ok) return null;
	return { type: kind, ...entry.assemble(props.data, body.value), position: fence } as Block;
}

function nestedBlocks(node: RootContent, diagnostics: Diagnostic[]) {
	if (!("children" in node)) return;
	for (const child of node.children as RootContent[]) {
		if (child.type === "code" && isBlockKind(child.lang)) {
			diagnostics.push({
				position: { line: child.position?.start.line ?? 1, column: child.position?.start.column ?? 1 },
				message: `${child.lang} block is inside a ${node.type === "blockquote" ? "quote" : "list"}`,
				hint: "move the fence to the top level of the report, unindented, with a blank line before it",
			});
		}
		nestedBlocks(child, diagnostics);
	}
}

const MAX_LISTED = 8;

function unknownSections(blocks: readonly Block[], headings: HeadingIndex): Diagnostic[] {
	const listed = headings.entries.slice(0, MAX_LISTED).map((h) => `"${h.text}"`);
	const more = headings.entries.length - listed.length;
	const available = headings.entries.length
		? `headings are: ${listed.join(", ")}${more > 0 ? ` and ${more} more` : ""}. Fix the spelling`
		: "this report has no headings. Add a ## heading to link to";
	const diagnostics: Diagnostic[] = [];
	for (const block of blocks) {
		if (block.type !== "diagram") continue;
		for (const box of block.boxes) {
			if (box.section === null) continue;
			const [first, second] = findHeadings(headings, box.section);
			if (!first) {
				diagnostics.push({
					position: box.position,
					message: `box "${box.id}" links to section "${box.section}", but no heading in this report has that text`,
					hint: `${available}, or remove section from the box`,
				});
			} else if (second) {
				diagnostics.push({
					position: box.position,
					message: `box "${box.id}" links to section "${box.section}", which is the text of the headings on lines ${first.line} and ${second.line}`,
					hint: "rename one of the headings so the link has one target",
				});
			}
		}
	}
	return diagnostics;
}

export function parseReport(source: string): Result<Report> {
	const tree = parseReportTree(source);
	const diagnostics: Diagnostic[] = [];
	const nodes = tree.children;
	const meta = parseFrontmatter(nodes[0], diagnostics);

	const blocks: Block[] = [];
	let prose: RootContent[] = [];
	const flush = () => {
		const start = prose[0]?.position?.start;
		if (start) blocks.push({ type: "prose", body: prose, position: { line: start.line, column: start.column } });
		prose = [];
	};
	for (const node of nodes) {
		if (node.type === "yaml") continue;
		if (node.type === "code" && isBlockKind(node.lang)) {
			flush();
			const block = parseFence(node, node.lang, diagnostics);
			if (block) blocks.push(block);
		} else {
			nestedBlocks(node, diagnostics);
			prose.push(node);
		}
	}
	flush();

	const headings = indexHeadings(blocks);
	diagnostics.push(...unknownSections(blocks, headings));

	if (diagnostics.length || !meta) {
		diagnostics.sort((a, b) => a.position.line - b.position.line || a.position.column - b.position.column);
		return { ok: false, diagnostics };
	}
	return { ok: true, value: { version: 1, title: meta.title, blocks, headings } };
}
