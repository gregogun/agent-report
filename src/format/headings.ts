import type { Block, Heading, HeadingIndex, Markdown } from "./types.js";

type Node = Markdown[number];

export function plainText(node: Node): string {
	if ("value" in node && typeof node.value === "string") return node.value;
	if ("children" in node) return (node.children as Node[]).map(plainText).join("");
	return "";
}

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "") || "section";

const normalized = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

export function indexHeadings(blocks: readonly Block[]): HeadingIndex {
	const entries: Heading[] = [];
	const ids = new WeakMap<object, string>();
	const used = new Set<string>();
	for (const block of blocks) {
		if (block.type !== "prose") continue;
		for (const node of block.body) {
			if (node.type !== "heading" || node.depth > 3) continue;
			const text = plainText(node);
			const base = slug(text);
			let id = base;
			for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
			used.add(id);
			ids.set(node, id);
			entries.push({ id, text, level: node.depth === 1 ? 2 : (node.depth as 2 | 3), line: node.position?.start.line ?? 1 });
		}
	}
	return { entries, ids };
}

export const findHeadings = (index: HeadingIndex, text: string): Heading[] => index.entries.filter((h) => normalized(h.text) === normalized(text));
