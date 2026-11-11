import { describe, expect, it } from "vitest";
import { renderReport } from "../src/render/index.js";
import type { ResolvedDiff } from "../src/resolve/index.js";

const diff = (patch: string): ResolvedDiff => ({ type: "diff", range: "a..b", path: "q.sql", patch, annotations: [], position: { line: 1, column: 1 } });

describe("rendered diff", () => {
	it("counts changed lines whose text starts with the marker character", async () => {
		const patch = ["--- a/q.sql", "+++ b/q.sql", "@@ -1,3 +1,3 @@", "--- comment one", "+-- comment two", " keep", "-++ plus", "+++ plus2", ""].join("\n");
		const report = await renderReport({ version: 1, title: "T", blocks: [diff(patch)] });
		expect(report.blocks[0]).toMatchObject({ added: 2, removed: 2 });
	});
});
