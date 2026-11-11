import type { RenderedBlock } from "../render/index.js";
import { plainText } from "./markdown.js";

export type TocEntry = { id: string; text: string; level: 2 | 3 };

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "") || "section";

/* Prose headings render as h2 and h3 at most (source depth 1 and 2 both become h2), and those make up the table of contents. */
export function headingIndex(blocks: readonly RenderedBlock[]): { entries: TocEntry[]; ids: WeakMap<object, string> } {
	const entries: TocEntry[] = [];
	const ids = new WeakMap<object, string>();
	const used = new Set<string>();
	for (const block of blocks) {
		if (block.type !== "prose") continue;
		for (const node of block.body) {
			if (node.type !== "heading" || node.depth > 3) continue;
			const label = plainText(node);
			const base = slug(label);
			let id = base;
			for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
			used.add(id);
			ids.set(node, id);
			entries.push({ id, text: label, level: node.depth === 1 ? 2 : (node.depth as 2 | 3) });
		}
	}
	return { entries, ids };
}
