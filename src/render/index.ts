import { preloadPatchDiff } from "@pierre/diffs/ssr";
import { renderToStaticMarkup } from "react-dom/server";
import { Md } from "../emit/markdown.js";
import type { ResolvedAnnotation, ResolvedDiff, ResolvedReport } from "../resolve/index.js";
import type { RenderedBlock, RenderedDiff, RenderedReport } from "./types.js";

export type * from "./types.js";

const slotName = (a: Pick<ResolvedAnnotation, "side" | "lineNumber">) => `annotation-${a.side}-${a.lineNumber}`;

function annotationHtml(a: ResolvedAnnotation, n: number): string {
	const { start, end } = a.lines;
	const where = `${a.side === "deletions" ? "Old line" : "Line"}${start === end ? "" : "s"} ${start === end ? start : `${start}\u2013${end}`}`;
	return `<aside class="note"><p class="note-label"><span class="note-n">${n}</span>${where}</p>${renderToStaticMarkup(Md({ body: a.body }))}</aside>`;
}

function countChanges(patch: string): { added: number; removed: number } {
	let added = 0;
	let removed = 0;
	let inHunk = false;
	for (const line of patch.split("\n")) {
		if (line.startsWith("@@")) inHunk = true;
		else if (inHunk && line.startsWith("+")) added++;
		else if (inHunk && line.startsWith("-")) removed++;
	}
	return { added, removed };
}

/* The library prepends a 16 KB icon sprite that only the file header references. With disableFileHeader nothing
   uses it, and a <use> cannot cross a shadow root anyway, so it is dropped unless a reference remains.
*/
const dropUnusedSprite = (html: string) => (html.includes("<use") ? html : html.replace(/^<svg data-icon-sprite[\s\S]*?<\/svg>/, ""));

async function renderDiff(diff: ResolvedDiff): Promise<RenderedDiff> {
	const { prerenderedHTML } = await preloadPatchDiff({
		patch: diff.patch,
		annotations: diff.annotations.map((a) => ({ side: a.side, lineNumber: a.lineNumber, metadata: undefined })),
		options: { theme: { dark: "pierre-dark", light: "pierre-light" }, diffStyle: "unified", disableFileHeader: true },
	});
	const slots = new Map<string, string[]>();
	diff.annotations.forEach((a, i) => slots.set(slotName(a), [...(slots.get(slotName(a)) ?? []), annotationHtml(a, i + 1)]));
	const slotted = [...slots].map(([name, notes]) => `<div slot="${name}">${notes.join("")}</div>`).join("");
	const html = `<diffs-container><template shadowrootmode="open">${dropUnusedSprite(prerenderedHTML)}</template>${slotted}</diffs-container>`;
	return { type: "diff", range: diff.range, path: diff.path, html, ...countChanges(diff.patch), notes: diff.annotations.length, position: diff.position };
}

export async function renderReport(report: ResolvedReport): Promise<RenderedReport> {
	const blocks: RenderedBlock[] = await Promise.all(report.blocks.map((b) => (b.type === "diff" ? renderDiff(b) : b)));
	return { ...report, blocks };
}
