import type { RootContent } from "mdast";

export type Position = { line: number; column: number };

export type Diagnostic = {
	position: Position;
	message: string;
	hint?: string;
};

export type Result<T> = { ok: true; value: T } | { ok: false; diagnostics: Diagnostic[] };

export type Markdown = RootContent[];

export type Side = "old" | "new";

export type LineRange = { start: number; end: number };

export type AnnotationAnchor =
	| { kind: "lines"; side: Side; lines: LineRange }
	| { kind: "text"; side: Side; text: string };

export type Annotation = {
	anchor: AnnotationAnchor;
	body: Markdown;
	position: Position;
};

export type CalloutKind = "note" | "concept" | "edge-case" | "warning";

export type DiagramBox = { id: string; label: string; path: string; position: Position };

export type ArrowKind = "direct" | "loose";

export type DiagramArrow = { from: string; to: string; kind: ArrowKind; position: Position };

export type Block =
	| { type: "prose"; body: Markdown; position: Position }
	| {
			type: "diff";
			range: string;
			path: string;
			hunks: LineRange | null;
			annotations: Annotation[];
			position: Position;
	  }
	| { type: "callout"; kind: CalloutKind; title: string | null; body: Markdown; position: Position }
	| {
			type: "decision";
			title: string;
			chosen: Markdown;
			why: Markdown;
			alternatives: { option: string; reason: Markdown }[];
			position: Position;
	  }
	| { type: "diagram"; boxes: DiagramBox[]; arrows: DiagramArrow[]; position: Position }
	| { type: "review-checklist"; items: Markdown[]; position: Position };

export type BlockType = Block["type"];

export type Report = {
	version: 1;
	title: string;
	blocks: Block[];
};
