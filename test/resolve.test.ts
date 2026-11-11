import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseReport } from "../src/format/index.js";
import { resolveReport } from "../src/resolve/index.js";

let repo: string;
let bare: string;

const git = (cwd: string, ...args: string[]) =>
	execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", stdio: "pipe" });

const lines = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i + 1));
const write = (name: string, rows: string[]) => writeFileSync(join(repo, name), `${rows.join("\n")}\n`);

beforeAll(() => {
	repo = mkdtempSync(join(tmpdir(), "agent-report-repo-"));
	bare = mkdtempSync(join(tmpdir(), "agent-report-plain-"));
	git(repo, "init", "-q", "-b", "main");
	git(repo, "config", "user.name", "Test");
	git(repo, "config", "user.email", "test@example.com");

	const a = lines(40, (i) => `export const v${i} = ${i};`);
	const b = lines(10, (i) => `line ${i}`);
	write("a.ts", a);
	write("b.ts", b);
	mkdirSync(join(repo, "lib"));
	write("lib/util.ts", ["export const util = 1;"]);
	git(repo, "add", ".");
	git(repo, "commit", "-q", "-m", "first");

	a[2] = 'export const renamed3 = "three";';
	a.splice(19, 1, "export const twenty = 20;", "export const twentyOne = 21;");
	a.splice(38, 1);
	b[4] = "line five changed";
	write("a.ts", a);
	write("b.ts", b);
	writeFileSync(join(repo, "bin.dat"), Buffer.from([0, 1, 2, 3]));
	git(repo, "add", ".");
	git(repo, "commit", "-q", "-m", "second");
	mkdirSync(join(repo, "sub"));
});

afterAll(() => {
	rmSync(repo, { recursive: true, force: true });
	rmSync(bare, { recursive: true, force: true });
});

const stripPositions = (value: unknown): unknown =>
	JSON.parse(JSON.stringify(value, (key, v) => (key === "position" && v?.start && "offset" in v.start ? undefined : v)));

const doc = (body: string) => `---\nversion: 1\ntitle: T\n---\n\n${body}\n`;

async function problems(body: string, cwd = repo) {
	const parsed = parseReport(doc(body));
	if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
	const result = await resolveReport(parsed.value, { cwd });
	if (result.ok) throw new Error("expected diagnostics");
	return result.diagnostics.map((d) => ({ line: d.position.line, message: d.message, hint: d.hint }));
}

describe("resolved report", () => {
	it("fetches patches, selects hunks, and anchors every annotation form", async () => {
		const parsed = parseReport(readFileSync("fixtures/resolve/report.md", "utf8"));
		if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
		const result = await resolveReport(parsed.value, { cwd: repo });
		if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
		await expect(stripPositions(result.value)).toMatchFileSnapshot("./__snapshots__/resolve.json");
	});

	it("reads paths relative to the repo root when run from a subdirectory", async () => {
		const parsed = parseReport(doc("```diff range=HEAD~1..HEAD path=b.ts\n```"));
		if (!parsed.ok) throw new Error("parse");
		const result = await resolveReport(parsed.value, { cwd: join(repo, "sub") });
		expect(result.ok).toBe(true);
	});
});

describe("diagnostics", () => {
	it("names a range git cannot resolve", async () => {
		const [d, ...rest] = await problems("```diff range=nope..HEAD path=a.ts\n```");
		expect(rest).toEqual([]);
		expect(d?.line).toBe(6);
		expect(d?.message).toBe('git cannot resolve the range "nope..HEAD"');
		expect(d?.hint).toContain("git said: fatal: bad revision 'nope..HEAD'");
	});

	it("rejects a range that looks like a git option", async () => {
		expect(await problems("```diff range=--output=x path=a.ts\n```")).toEqual([
			{ line: 6, message: 'git range "--output=x" starts with "-"', hint: "give a revision range like main..HEAD or HEAD~1..HEAD" },
		]);
	});

	it("reports a path with no changes", async () => {
		expect(await problems("```diff range=HEAD~1..HEAD path=missing.ts\n```")).toEqual([
			{
				line: 6,
				message: '"missing.ts" has no changes in HEAD~1..HEAD',
				hint: "check the path is relative to the repo root and that the file changed in this range",
			},
		]);
	});

	it("reports a hunk selection past the end", async () => {
		expect(await problems("```diff range=HEAD~1..HEAD path=a.ts hunks=2-5\n```")).toEqual([
			{
				line: 6,
				message: 'hunks=2-5 goes past the end, "a.ts" has 3 hunks in HEAD~1..HEAD',
				hint: "use hunks between 1 and 3, or leave hunks out to show everything",
			},
		]);
		expect(await problems("```diff range=HEAD~1..HEAD path=b.ts hunks=2\n```")).toEqual([
			{
				line: 6,
				message: 'hunks=2 goes past the end, "b.ts" has 1 hunk in HEAD~1..HEAD',
				hint: "use hunks=1 or leave hunks out to show the whole file diff",
			},
		]);
	});

	it("reports a cwd outside a git repo once", async () => {
		const body = "```diff range=HEAD~1..HEAD path=a.ts\n```\n\n```diff range=HEAD~1..HEAD path=b.ts\n```";
		expect(await problems(body, bare)).toEqual([
			{
				line: 6,
				message: `${bare} is not inside a git repository`,
				hint: "run agent-report from the repo that holds the diffs and diagrams, or from a subdirectory of it",
			},
		]);
	});

	it("reports a missing directory", async () => {
		const [d] = await problems("```diff range=HEAD~1..HEAD path=a.ts\n```", join(bare, "gone"));
		expect(d?.message).toBe(`the directory ${join(bare, "gone")} does not exist`);
	});

	it("reports an annotation line that is not shown, listing what is", async () => {
		expect(await problems("```diff range=HEAD~1..HEAD path=a.ts hunks=1\n@new:99 Nope.\n@old:30 Nope.\n```")).toEqual([
			{
				line: 7,
				message: "annotation points at new line 99, which is not shown in this diff",
				hint: "new lines shown: 1-6",
			},
			{
				line: 8,
				message: "annotation points at old line 30, which is not shown in this diff",
				hint: "old lines shown: 1-6",
			},
		]);
	});

	it("checks the whole range of a range anchor, and each hunk's visible lines", async () => {
		const [d] = await problems("```diff range=HEAD~1..HEAD path=a.ts hunks=2-3\n@new:16-18 Spans the edge.\n```");
		expect(d?.message).toBe("annotation points at new line 16, which is not shown in this diff");
		expect(d?.hint).toBe("new lines shown: 17-24, 36-40");
	});

	it("reports a text anchor with no match", async () => {
		expect(await problems('```diff range=HEAD~1..HEAD path=a.ts\n@"nothing here" Hmm.\n@old:"twentyOne" Wrong side.\n```')).toEqual([
			{
				line: 7,
				message: 'no shown new line contains the quoted code "nothing here"',
				hint: "quote text that appears on a line of this diff, or anchor by line number instead",
			},
			{
				line: 8,
				message: 'no shown old line contains the quoted code "twentyOne"',
				hint: "quote text that appears on a line of this diff, or anchor by line number instead",
			},
		]);
	});

	it("reports a text anchor with several matches", async () => {
		expect(await problems('```diff range=HEAD~1..HEAD path=b.ts\n@"line" Too broad.\n```')).toEqual([
			{
				line: 7,
				message: 'quoted code "line" matches 7 new lines: 2, 3, 4, 5, 6, 7, 8',
				hint: "quote more of the line so only one line matches, or anchor by line number instead",
			},
		]);
	});

	it("reports a binary file", async () => {
		expect(await problems("```diff range=HEAD~1..HEAD path=bin.dat\n```")).toEqual([
			{
				line: 6,
				message: '"bin.dat" is a binary file, so there is no diff to show',
				hint: "remove this diff block or point it at a text file",
			},
		]);
	});

	it("reports a path that matches several files", async () => {
		const [d] = await problems("```diff range=HEAD~1..HEAD path=.\n```");
		expect(d?.message).toBe('"." matches 3 changed files in HEAD~1..HEAD');
	});

	it("collects every diagnostic in one pass, in report order", async () => {
		const got = await problems(
			"```diff range=HEAD~1..HEAD path=missing.ts\n```\n\n```diff range=HEAD~1..HEAD path=b.ts\n@new:99 Nope.\n```",
		);
		expect(got.map((d) => d.line)).toEqual([6, 10]);
	});
});

describe("diagram paths", () => {
	const diagram = (head: string, ...paths: string[]) =>
		[`\`\`\`diagram${head}`, "boxes:", ...paths.flatMap((p, i) => [`  - id: b${i}`, `    label: B${i}`, `    path: ${p}`]), "```"].join("\n");

	const resolves = async (body: string) => {
		const parsed = parseReport(doc(body));
		if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
		return (await resolveReport(parsed.value, { cwd: repo })).ok;
	};

	it("accepts a file and a directory in the working tree", async () => {
		expect(await resolves(diagram("", "a.ts", "lib", "lib/", "sub", "bin.dat"))).toBe(true);
	});

	it("accepts a file and a directory at a ref, and checks that ref rather than the working tree", async () => {
		expect(await resolves(diagram(" ref=HEAD~1", "a.ts", "lib"))).toBe(true);
		expect(await problems(diagram(" ref=HEAD~1", "bin.dat", "sub"))).toEqual([
			{ line: 8, message: 'box "b0" points at "bin.dat", which does not exist in HEAD~1', hint: 'write the path of a file or directory relative to the repo root' },
			{ line: 11, message: 'box "b1" points at "sub", which does not exist in HEAD~1', hint: 'write the path of a file or directory relative to the repo root' },
		]);
	});

	it("fails an unknown path at the box's line and names the closest real path", async () => {
		expect(await problems(diagram("", "a.ts", "lib/utils.ts", "elsewhere/b.ts"))).toEqual([
			{ line: 11, message: 'box "b1" points at "lib/utils.ts", which does not exist in the working tree', hint: 'did you mean "lib/util.ts"?' },
			{ line: 14, message: 'box "b2" points at "elsewhere/b.ts", which does not exist in the working tree', hint: 'did you mean "b.ts"?' },
		]);
	});

	it("offers no suggestion when nothing is close", async () => {
		const [d] = await problems(diagram("", "zzzzzz/qqqqqq"));
		expect(d?.hint).toBe("write the path of a file or directory relative to the repo root");
	});

	it("rejects an unknown ref at the block's line, once", async () => {
		expect(await problems(diagram(" ref=nope", "a.ts", "b.ts"))).toEqual([
			{ line: 6, message: 'git cannot resolve the ref "nope"', hint: `give a branch, tag or commit that exists in this repo, like main or HEAD` },
		]);
	});

	it("rejects a path that leaves the repo", async () => {
		const [d] = await problems(diagram("", "../outside"));
		expect(d?.message).toBe('box "b0" path "../outside" is outside the repo');
	});
});
