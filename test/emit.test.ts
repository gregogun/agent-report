import { expect, it } from "vitest";
import { emitReport } from "../src/emit/index.js";
import { parseReport } from "../src/format/index.js";
import { renderReport } from "../src/render/index.js";

it("gives every heading a distinct id, even when a heading text looks like a suffixed one", async () => {
	const parsed = parseReport("---\nversion: 1\ntitle: T\n---\n\n# A\n\n# A\n\n# A 2\n");
	if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
	const ids = [...emitReport(await renderReport({ ...parsed.value, blocks: parsed.value.blocks.filter((b) => b.type === "prose") })).matchAll(/<h2 id="([^"]+)"/g)].map((m) => m[1]);
	expect(ids).toHaveLength(3);
	expect(new Set(ids).size).toBe(3);
});
