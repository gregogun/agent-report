import { describe, expect, it } from "vitest";
import { parsePatch, selectHunks, serializePatch } from "../src/resolve/patch.js";

const head = ["diff --git a/f b/f", "index 1..2 100644", "--- a/f", "+++ b/f"];

describe("parsePatch", () => {
	it("numbers each line on its own side", () => {
		const text = [...head, "@@ -5,3 +5,3 @@ fn", " keep", "-old", "+new", " tail", ""].join("\n");
		const { hunks } = parsePatch(text);
		expect(hunks[0]?.lines.map((l) => [l.kind, l.oldLine, l.newLine])).toEqual([
			["context", 5, 5],
			["del", 6, null],
			["add", null, 6],
			["context", 7, 7],
		]);
	});

	it("reads hunk headers without counts", () => {
		const text = [...head, "@@ -1 +1 @@", "-a", "+b", ""].join("\n");
		const { hunks } = parsePatch(text);
		expect(hunks[0]?.lines.map((l) => [l.kind, l.oldLine, l.newLine])).toEqual([
			["del", 1, null],
			["add", null, 1],
		]);
	});

	it("keeps the no-newline marker on the line it follows, through a round trip", () => {
		const text = [...head, "@@ -1 +1 @@", "-a", "\\ No newline at end of file", "+b", ""].join("\n");
		const { header, hunks } = parsePatch(text);
		expect(hunks[0]?.lines.map((l) => l.noNewline)).toEqual([true, false]);
		expect(serializePatch(header, hunks)).toBe(text);
	});

	it("keeps header lines and selects hunks by 1-based range", () => {
		const text = [...head, "@@ -1 +1 @@", "-a", "+b", "@@ -9 +9 @@", "-c", "+d", ""].join("\n");
		const { header, hunks } = parsePatch(text);
		expect(header).toEqual(head);
		const out = serializePatch(header, selectHunks(hunks, { start: 2, end: 2 }));
		expect(out).toBe([...head, "@@ -9 +9 @@", "-c", "+d", ""].join("\n"));
	});

	it("treats a bare empty line inside a hunk as blank context", () => {
		const text = [...head, "@@ -1,2 +1,2 @@", "", "-a", "+b", ""].join("\n");
		expect(parsePatch(text).hunks[0]?.lines[0]).toMatchObject({ kind: "context", text: "", oldLine: 1, newLine: 1 });
	});
});
