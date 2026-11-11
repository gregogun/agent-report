import { describe, expect, it } from "vitest";
import { renderReport } from "../src/render/index.js";
import type { ResolvedAnnotation, ResolvedDiff } from "../src/resolve/index.js";

const diff = (patch: string): ResolvedDiff => ({ type: "diff", range: "a..b", path: "q.sql", patch, annotations: [], position: { line: 1, column: 1 } });

describe("rendered diff", () => {
	it("counts changed lines whose text starts with the marker character", async () => {
		const patch = ["--- a/q.sql", "+++ b/q.sql", "@@ -1,3 +1,3 @@", "--- comment one", "+-- comment two", " keep", "-++ plus", "+++ plus2", ""].join("\n");
		const report = await renderReport({ version: 1, title: "T", headings: { entries: [], ids: new WeakMap() }, blocks: [diff(patch)] });
		expect(report.blocks[0]).toMatchObject({ added: 2, removed: 2 });
	});

	it("labels an old-side note by its old line, which may be a context line", async () => {
		const patch = ["--- a/x.ts", "+++ b/x.ts", "@@ -1,3 +1,2 @@", " a", "-b", " c", ""].join("\n");
		const note: ResolvedAnnotation = { side: "deletions", lineNumber: 3, lines: { start: 3, end: 3 }, body: [], position: { line: 1, column: 1 } };
		const report = await renderReport({ version: 1, title: "T", headings: { entries: [], ids: new WeakMap() }, blocks: [{ ...diff(patch), annotations: [note] }] });
		const html = report.blocks[0]?.type === "diff" ? report.blocks[0].html : "";
		expect(html).toContain("</span>Old line 3</p>");
		expect(html).not.toContain("Removed");
	});
});
