import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANCHORS, registry } from "../src/format/blocks.js";
import { parseReport } from "../src/format/index.js";
import { formatReference } from "../src/format/reference.js";

const doc = (body: string) => `---\nversion: 1\ntitle: T\n---\n\n${body}\n`;

function errors(source: string) {
	const result = parseReport(source);
	if (result.ok) throw new Error("expected diagnostics");
	return result.diagnostics.map((d) => ({ line: d.position.line, message: d.message, hint: d.hint }));
}

const stripPositions = (value: unknown): unknown =>
	JSON.parse(JSON.stringify(value, (key, v) => (key === "position" && v?.start && "offset" in v.start ? undefined : v)));

describe("valid report", () => {
	it("parses every block type and anchor form", async () => {
		const result = parseReport(readFileSync("fixtures/format/valid.md", "utf8"));
		if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
		await expect(stripPositions(result.value)).toMatchFileSnapshot("./__snapshots__/valid.json");
	});

	it("parses every registry example", () => {
		for (const entry of Object.values(registry)) {
			const result = parseReport(doc(entry.example));
			expect(result.ok, entry.example).toBe(true);
		}
	});
});

describe("diagnostics", () => {
	it("requires frontmatter", () => {
		expect(errors("# hi")).toEqual([
			{ line: 1, message: "report is missing its frontmatter", hint: "start the report with a --- block containing version: 1 and title: <report title>" },
		]);
	});

	it("requires a title", () => {
		expect(errors("---\nversion: 1\n---\n")).toEqual([
			{ line: 2, message: 'frontmatter is missing "title"', hint: "add a line like title: <report title>" },
		]);
	});

	it("rejects other versions", () => {
		expect(errors("---\nversion: 2\ntitle: T\n---\n")).toEqual([
			{ line: 2, message: "frontmatter has invalid version: unsupported format version 2", hint: "set version: 1, the only format version this build reads" },
		]);
	});

	it("reports props errors on the fence line", () => {
		expect(errors(doc("```diff range=main..HEAD\n```"))).toEqual([
			{ line: 6, message: 'diff block is missing "path"', hint: "add path=<file path relative to the repo root>" },
		]);
	});

	it("lists allowed props for unknown keys", () => {
		expect(errors(doc("```callout kind=note color=red\nhi\n```"))).toEqual([
			{ line: 6, message: 'callout block has unknown prop "color"', hint: "allowed props: kind (required), title (optional)" },
		]);
	});

	it("rejects bad enum values", () => {
		expect(errors(doc("```callout kind=tip\nhi\n```"))).toEqual([
			{ line: 6, message: 'callout block has invalid kind "tip"', hint: "use one of: note, concept, edge-case, warning" },
		]);
	});

	it("rejects bad hunks", () => {
		expect(errors(doc("```diff range=a..b path=x hunks=0\n```"))).toEqual([
			{ line: 6, message: "diff block has invalid hunks: must be N or N-M with 1-based hunk numbers, like 2 or 2-3", hint: undefined },
		]);
	});

	it("rejects unreadable props text", () => {
		expect(errors(doc("```callout kind=note oops\nhi\n```"))).toEqual([
			{ line: 6, message: 'callout block has unreadable props text "oops"', hint: 'write props as key=value, or key="value with spaces"' },
		]);
	});

	it("rejects repeated props", () => {
		expect(errors(doc("```callout kind=note kind=note\nhi\n```"))).toEqual([
			{ line: 6, message: 'callout block repeats prop "kind"', hint: 'give "kind" once' },
		]);
	});

	const anchors = '@new:42, @new:57-61, @old:12, @"quoted code" (side defaults to new), @old:"quoted code"';

	it("rejects bad anchors on the exact body line", () => {
		expect(errors(doc("```diff range=a..b path=x\n@new:1 ok\n@line 5 nope\n```"))).toEqual([
			{ line: 8, message: 'invalid annotation anchor "@line"', hint: `accepted anchors: ${anchors}` },
		]);
	});

	it("rejects text before the first annotation", () => {
		expect(errors(doc("```diff range=a..b path=x\nstray\n```"))).toEqual([
			{ line: 7, message: "diff body has text before the first annotation", hint: `start each annotation with an anchor: ${anchors}` },
		]);
	});

	it("rejects empty annotations, line 0 and reversed ranges", () => {
		expect(errors(doc("```diff range=a..b path=x\n@new:3\n@new:0 a\n@new:9-4 b\n```"))).toEqual([
			{ line: 7, message: "annotation has no text after its anchor", hint: "write the annotation after the anchor, like @new:42 Why this changed" },
			{ line: 8, message: "annotation line numbers start at 1", hint: "use @new:1 for the first line" },
			{ line: 9, message: "annotation line range 9-4 ends before it starts", hint: "write @new:4-9" },
		]);
	});

	it("rejects an empty callout", () => {
		expect(errors(doc("```callout kind=note\n```"))).toEqual([
			{ line: 7, message: "callout body is empty", hint: "write the callout text as markdown between the fences" },
		]);
	});

	it("rejects a checklist that is not a list", () => {
		expect(errors(doc("```review-checklist\nsome text\n```"))).toEqual([
			{ line: 7, message: "review-checklist body must be a markdown list and nothing else", hint: "write one item per line, like - Check the migration is reversible" },
		]);
	});

	it("maps YAML syntax errors to report lines", () => {
		const [first] = errors(doc('```decision title=T\nchosen: [oops\nwhy: x\n```'));
		expect(first?.message).toMatch(/^decision body is not valid YAML: /);
		expect(first?.line).toBe(8);
	});

	it("maps decision schema errors to the YAML line", () => {
		expect(errors(doc("```decision title=T\nchosen: A\nwhy: B\nalternatives:\n  - option: C\n```"))).toEqual([
			{ line: 10, message: 'decision body alternatives[0] is missing "reason"', hint: "add a line like reason: <why you rejected it>" },
		]);
	});

	it("reports a missing decision key and unknown key", () => {
		expect(errors(doc("```decision title=T\nchosen: A\nextra: 1\n```"))).toEqual([
			{ line: 8, message: 'decision body has unknown key "extra"', hint: "allowed keys: chosen (required), why (required), alternatives (optional)" },
			{ line: 7, message: 'decision body is missing "why"', hint: "add a line like why: <why you chose it>" },
		].sort((a, b) => a.line - b.line));
	});

	describe("diagram", () => {
		const box = (id: string, extra = "") => `  - id: ${id}\n    label: ${id.toUpperCase()}\n    path: src/${id}${extra}`;
		const diagram = (...lines: string[]) => doc(`\`\`\`diagram\n${lines.join("\n")}\n\`\`\``);

		it("rejects a duplicate box id at the second box's id line", () => {
			expect(errors(diagram("boxes:", box("a"), box("b"), box("a"), "arrows:", "  - from: a", "    to: b"))).toEqual([
				{
					line: 14,
					message: 'diagram body box id "a" is already used by the box on line 8',
					hint: "give every box its own id, or delete the duplicate box",
				},
			]);
		});

		it("rejects an arrow to an unknown box at the arrow's line and lists the boxes", () => {
			expect(errors(diagram("boxes:", box("a"), box("b"), "arrows:", "  - from: a", "    to: bee"))).toEqual([
				{
					line: 16,
					message: 'diagram body arrows[0].to "bee" is not the id of any box',
					hint: "boxes are: a, b. Fix the spelling, or add a box with id bee",
				},
			]);
		});

		it("reports an unknown arrow start on its own line", () => {
			expect(errors(diagram("boxes:", box("a"), "arrows:", "  - from: zed", "    to: a"))).toEqual([
				{
					line: 12,
					message: 'diagram body arrows[0].from "zed" is not the id of any box',
					hint: "boxes are: a. Fix the spelling, or add a box with id zed",
				},
			]);
		});

		it("reports a missing field at the box that lacks it", () => {
			expect(errors(diagram("boxes:", "  - id: a", "    path: src/a"))).toEqual([
				{ line: 8, message: 'diagram body boxes[0] is missing "label"', hint: "add a line like label: <text drawn in the box>" },
			]);
		});

		it("reports a wrongly typed field on its line", () => {
			expect(errors(diagram("boxes:", "  - id: a", "    label: [x]", "    path: src/a"))).toEqual([
				{ line: 9, message: 'diagram body boxes[0] has invalid "label": expected string', hint: undefined },
			]);
		});

		it("rejects an unknown arrow kind with the allowed values", () => {
			expect(errors(diagram("boxes:", box("a"), box("b"), "arrows:", "  - from: a", "    to: b", "    kind: maybe"))).toEqual([
				{ line: 17, message: 'diagram body arrows[0] has invalid kind "maybe"', hint: "use one of: direct, loose" },
			]);
		});

		it("rejects a box id Mermaid could not carry, with a hint", () => {
			expect(errors(diagram("boxes:", "  - id: my box", "    label: A", "    path: src/a"))).toEqual([
				{
					line: 8,
					message: "diagram body boxes[0] has invalid id: must start with a letter and use only letters, digits, - and _",
					hint: "use a short name like resolve or http-api, with no spaces",
				},
			]);
		});

		it("keeps arrows optional and defaults them to direct", () => {
			const result = parseReport(diagram("boxes:", box("a"), box("b"), "arrows:", "  - from: a", "    to: b"));
			const block = result.ok ? result.value.blocks[0] : undefined;
			expect(block?.type === "diagram" && block.arrows.map((a) => a.kind)).toEqual(["direct"]);
			expect(parseReport(diagram("boxes:", box("a"))).ok).toBe(true);
		});
	});

	it("reports every error in one pass", () => {
		const found = errors(
			"---\nversion: 1\n---\n\n```diff range=a..b\n@bad\n```\n\n```callout kind=tip\n```\n\n```review-checklist\ntext\n```\n",
		);
		expect(found.map((d) => d.message)).toEqual([
			'frontmatter is missing "title"',
			'diff block is missing "path"',
			'invalid annotation anchor "@bad"',
			'callout block has invalid kind "tip"',
			"callout body is empty",
			"review-checklist body must be a markdown list and nothing else",
		]);
		expect(found.map((d) => d.line)).toEqual([2, 5, 6, 9, 10, 13]);
	});

	it("rejects a block fence nested in a list or quote", () => {
		expect(errors(doc("- item\n\n  ```diff range=a..b path=x\n  @new:1 hi\n  ```\n\n> ```callout kind=note\n> hi\n> ```"))).toEqual([
			{ line: 8, message: "diff block is inside a list", hint: "move the fence to the top level of the report, unindented, with a blank line before it" },
			{ line: 12, message: "callout block is inside a quote", hint: "move the fence to the top level of the report, unindented, with a blank line before it" },
		]);
	});

	it("leaves other fence languages as prose", () => {
		const result = parseReport(doc("```ts\nconst a = 1;\n```"));
		expect(result.ok && result.value.blocks.map((b) => b.type)).toEqual(["prose"]);
	});
});

describe("reference", () => {
	const text = formatReference();

	it("validates every example it prints", () => {
		const fences = [...text.matchAll(/````markdown\n([\s\S]*?)\n````/g)].map((m) => m[1] as string);
		expect(fences).toHaveLength(Object.keys(registry).length);
		for (const example of fences) {
			const result = parseReport(doc(example));
			expect(result.ok, example).toBe(true);
		}
	});

	it("mentions every registry key, prop, and anchor form", () => {
		for (const [kind, entry] of Object.entries(registry)) {
			expect(text).toContain(`## \`${kind}\``);
			for (const prop of Object.keys(entry.props.shape)) expect(text).toContain(`\`${prop}\``);
		}
		for (const a of ANCHORS) expect(text).toContain(a.form);
	});
});
