import type { Position } from "../format/index.js";
import type { ResolvedBlock, ResolvedReport } from "../resolve/index.js";

export type RenderedDiff = {
	type: "diff";
	range: string;
	path: string;
	html: string;
	added: number;
	removed: number;
	notes: number;
	position: Position;
};

export type RenderedBlock = Exclude<ResolvedBlock, { type: "diff" }> | RenderedDiff;

export type RenderedReport = Omit<ResolvedReport, "blocks"> & { blocks: RenderedBlock[] };
