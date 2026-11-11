import { expect, it } from "vitest";
import { emitReport } from "../src/emit/index.js";
import { parseReport } from "../src/format/index.js";
import { renderReport } from "../src/render/index.js";
import { resolveReport } from "../src/resolve/index.js";

const build = async (source: string) => {
	const parsed = parseReport(source);
	if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
	const resolved = await resolveReport(parsed.value, { cwd: process.cwd() });
	if (!resolved.ok) throw new Error(JSON.stringify(resolved.diagnostics));
	return emitReport(await renderReport(resolved.value));
};

const withDiagram = (label: string) =>
	["---", "version: 1", "title: T", "---", "", "```diagram", "boxes:", "  - id: a", `    label: ${JSON.stringify(label)}`, "    path: src/format", "  - id: b", "    label: B", "    path: src/resolve", "arrows:", "  - from: a", "    to: b", "```", ""].join("\n");

const textsOf = (html: string) => [...html.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => (m[1] as string).replace(/<[^>]+>/g, ""));

it("draws a label that holds a backtick, quotes, angle brackets and a hash as literal text", async () => {
	const html = await build(withDiagram('a`b "q" <i>x</i> #1'));
	expect(textsOf(html)).toContain("a`b &quot;q&quot; &lt;i&gt;x&lt;/i&gt; #1src/format");
	expect(html).not.toContain("<i>");
});

it("draws loose arrows dashed and direct arrows solid", async () => {
	const source = withDiagram("A").replace("    to: b\n", "    to: b\n  - from: b\n    to: a\n    kind: loose\n");
	const edges = [...(await build(source)).matchAll(/<g class="pele-edge"[^>]*><path d="[^"]*"([^>]*)\/>/g)].map((m) => (m[1] as string).includes("stroke-dasharray"));
	expect(edges).toEqual([false, true, false, true]);
});

it("inlines the diagram font only in a report that has a diagram", async () => {
	const plain = await build("---\nversion: 1\ntitle: T\n---\n\nHello.\n");
	expect(plain).not.toContain("@font-face");
	expect(await build(withDiagram("A"))).toContain("@font-face");
});
