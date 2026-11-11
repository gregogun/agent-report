import type { LineRange } from "../format/index.js";

export type LineKind = "context" | "add" | "del";

export type PatchLine = {
	kind: LineKind;
	text: string;
	oldLine: number | null;
	newLine: number | null;
	noNewline: boolean;
};

export type Hunk = {
	header: string;
	lines: PatchLine[];
};

export type ParsedPatch = {
	header: string[];
	hunks: Hunk[];
};

const NO_NEWLINE = "\\ No newline at end of file";
const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const PREFIX: Record<string, LineKind> = { " ": "context", "+": "add", "-": "del" };

export function parsePatch(text: string): ParsedPatch {
	const rows = text.split("\n");
	if (rows.at(-1) === "") rows.pop();
	const header: string[] = [];
	const hunks: Hunk[] = [];
	let hunk: Hunk | null = null;
	let oldLine = 0;
	let newLine = 0;

	for (const row of rows) {
		if (row.startsWith("@@")) {
			const m = HUNK_HEADER.exec(row);
			if (!m) throw new Error(`malformed hunk header: ${row}`);
			oldLine = Number(m[1]);
			newLine = Number(m[2]);
			hunk = { header: row, lines: [] };
			hunks.push(hunk);
			continue;
		}
		if (!hunk) {
			header.push(row);
			continue;
		}
		if (row.startsWith("\\")) {
			const last = hunk.lines.at(-1);
			if (last) last.noNewline = true;
			continue;
		}
		const kind = row === "" ? "context" : PREFIX[row[0] ?? ""];
		if (!kind) throw new Error(`unexpected line in hunk: ${row}`);
		hunk.lines.push({
			kind,
			text: row.slice(1),
			oldLine: kind === "add" ? null : oldLine,
			newLine: kind === "del" ? null : newLine,
			noNewline: false,
		});
		if (kind !== "add") oldLine++;
		if (kind !== "del") newLine++;
	}
	return { header, hunks };
}

const MARK = { context: " ", add: "+", del: "-" } as const;

export function serializePatch(header: string[], hunks: Hunk[]): string {
	const rows = [...header];
	for (const hunk of hunks) {
		rows.push(hunk.header);
		for (const line of hunk.lines) {
			rows.push(MARK[line.kind] + line.text);
			if (line.noNewline) rows.push(NO_NEWLINE);
		}
	}
	return `${rows.join("\n")}\n`;
}

export function selectHunks(hunks: Hunk[], range: LineRange | null): Hunk[] {
	return range ? hunks.slice(range.start - 1, range.end) : hunks;
}
