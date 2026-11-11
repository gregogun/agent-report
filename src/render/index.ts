import { preloadPatchDiff } from "@pierre/diffs/ssr";
import { renderToStaticMarkup } from "react-dom/server";
import { Md } from "../emit/markdown.js";
import type { ResolvedAnnotation, ResolvedDiff, ResolvedReport } from "../resolve/index.js";
import type { RenderedBlock, RenderedDiff, RenderedReport } from "./types.js";

export type * from "./types.js";

const slotName = (a: Pick<ResolvedAnnotation, "side" | "lineNumber">) => `annotation-${a.side}-${a.lineNumber}`;

function annotationHtml(a: ResolvedAnnotation): string {
	const range = a.lines.start === a.lines.end ? "" : `<span class="note-range">lines ${a.lines.start}–${a.lines.end}</span>`;
	return `<aside class="note">${range}${renderToStaticMarkup(Md({ body: a.body }))}</aside>`;
}

async function renderDiff(diff: ResolvedDiff): Promise<RenderedDiff> {
	const { prerenderedHTML } = await preloadPatchDiff({
		patch: diff.patch,
		annotations: diff.annotations.map((a) => ({ side: a.side, lineNumber: a.lineNumber, metadata: undefined })),
		options: { theme: { dark: "pierre-dark", light: "pierre-light" }, diffStyle: "unified" },
	});
	const slots = new Map<string, string[]>();
	for (const a of diff.annotations) slots.set(slotName(a), [...(slots.get(slotName(a)) ?? []), annotationHtml(a)]);
	const slotted = [...slots].map(([name, notes]) => `<div slot="${name}">${notes.join("")}</div>`).join("");
	const html = `<diffs-container><template shadowrootmode="open">${prerenderedHTML}</template>${slotted}</diffs-container>`;
	return { type: "diff", range: diff.range, path: diff.path, html, position: diff.position };
}

export async function renderReport(report: ResolvedReport): Promise<RenderedReport> {
	const blocks: RenderedBlock[] = await Promise.all(report.blocks.map((b) => (b.type === "diff" ? renderDiff(b) : b)));
	return { ...report, blocks };
}
