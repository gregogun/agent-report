import type { Markdown } from "../format/index.js";
import type { RenderedBlock } from "../render/index.js";

type Node = Markdown[number];

export type TocEntry = { id: string; text: string; level: 2 | 3 };

const text = (node: Node): string => {
	if ("value" in node && typeof node.value === "string") return node.value;
	return "children" in node ? (node.children as Node[]).map(text).join("") : "";
};

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "") || "section";

/* Prose headings render as h2 and h3 at most (source depth 1 and 2 both become h2), and those make up the table of contents. */
export function headingIndex(blocks: readonly RenderedBlock[]): { entries: TocEntry[]; ids: WeakMap<object, string> } {
	const entries: TocEntry[] = [];
	const ids = new WeakMap<object, string>();
	const seen = new Map<string, number>();
	for (const block of blocks) {
		if (block.type !== "prose") continue;
		for (const node of block.body) {
			if (node.type !== "heading" || node.depth > 3) continue;
			const label = text(node);
			const base = slug(label);
			const n = seen.get(base) ?? 0;
			seen.set(base, n + 1);
			const id = n ? `${base}-${n + 1}` : base;
			ids.set(node, id);
			entries.push({ id, text: label, level: node.depth === 1 ? 2 : (node.depth as 2 | 3) });
		}
	}
	return { entries, ids };
}
