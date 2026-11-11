import type { Block, LineRange, Markdown, Position, Report } from "../format/index.js";

export type ResolvedAnnotation = {
	side: "additions" | "deletions";
	lineNumber: number;
	lines: LineRange;
	body: Markdown;
	position: Position;
};

export type ResolvedDiff = {
	type: "diff";
	range: string;
	path: string;
	patch: string;
	annotations: ResolvedAnnotation[];
	position: Position;
};

export type ResolvedBlock = Exclude<Block, { type: "diff" }> | ResolvedDiff;

export type ResolvedReport = Omit<Report, "blocks"> & { blocks: ResolvedBlock[] };

