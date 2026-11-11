import type { Annotation, Diagnostic, Result, Side } from "../format/index.js";
import type { Hunk } from "./patch.js";
import type { ResolvedAnnotation } from "./types.js";

type Shown = { line: number; text: string };

function shownLines(hunks: Hunk[], side: Side): Shown[] {
	const shown: Shown[] = [];
	for (const hunk of hunks) {
		for (const l of hunk.lines) {
			const line = side === "new" ? l.newLine : l.oldLine;
			if (line !== null) shown.push({ line, text: l.text });
		}
	}
	return shown;
}

export function formatRanges(lines: number[]): string {
	const runs: string[] = [];
	for (let i = 0; i < lines.length; ) {
		let j = i;
		while (lines[j + 1] === (lines[j] ?? 0) + 1) j++;
		runs.push(i === j ? `${lines[i]}` : `${lines[i]}-${lines[j]}`);
		i = j + 1;
	}
	return runs.join(", ");
}

export function anchorAnnotation(annotation: Annotation, hunks: Hunk[]): Result<ResolvedAnnotation> {
	const { anchor, position } = annotation;
	const side = anchor.side;
	const shown = shownLines(hunks, anchor.side);
	const fail = (message: string, hint: string): Result<ResolvedAnnotation> => {
		const diagnostic: Diagnostic = { position, message, hint };
		return { ok: false, diagnostics: [diagnostic] };
	};
	const done = (start: number, end: number): Result<ResolvedAnnotation> => ({
		ok: true,
		value: {
			side: anchor.side === "new" ? "additions" : "deletions",
			lineNumber: end,
			lines: { start, end },
			body: annotation.body,
			position,
		},
	});

	if (anchor.kind === "lines") {
		const visible = new Set(shown.map((s) => s.line));
		for (let line = anchor.lines.start; line <= anchor.lines.end; line++) {
			if (visible.has(line)) continue;
			return fail(
				`annotation points at ${side} line ${line}, which is not shown in this diff`,
				shown.length
					? `${side} lines shown: ${formatRanges(shown.map((s) => s.line))}`
					: `no ${side} lines are shown in this diff, so use the other side`,
			);
		}
		return done(anchor.lines.start, anchor.lines.end);
	}

	const matches = shown.filter((s) => s.text.includes(anchor.text)).map((s) => s.line);
	if (matches.length === 1) return done(matches[0] as number, matches[0] as number);
	if (matches.length === 0) {
		return fail(
			`no shown ${side} line contains the quoted code "${anchor.text}"`,
			"quote text that appears on a line of this diff, or anchor by line number instead",
		);
	}
	return fail(
		`quoted code "${anchor.text}" matches ${matches.length} ${side} lines: ${matches.join(", ")}`,
		"quote more of the line so only one line matches, or anchor by line number instead",
	);
}
