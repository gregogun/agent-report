import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

it("counts first-draft failures and retries from a stubbed agent", () => {
	const dir = mkdtempSync(join(tmpdir(), "agent-report-h2h-"));
	const git = (...args: string[]) =>
		execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8", stdio: "pipe" });
	git("init", "-q", "-b", "main");
	git("config", "user.name", "Test");
	git("config", "user.email", "test@example.com");
	const lines = Array.from({ length: 12 }, (_, i) => `export const v${i + 1} = ${i + 1};`);
	writeFileSync(join(dir, "a.ts"), `${lines.join("\n")}\n`);
	git("add", ".");
	git("commit", "-q", "-m", "first");
	lines[5] = "export const sixth = 600;";
	writeFileSync(join(dir, "a.ts"), `${lines.join("\n")}\n`);
	git("add", ".");
	git("commit", "-q", "-m", "second");

	const cases = join(dir, "cases.txt");
	writeFileSync(cases, `${dir} HEAD~1..HEAD\n`);
	const out = join(dir, "out");
	const gist = join(dir, "gist.md");
	writeFileSync(gist, "gist stand-in\n");
	execFileSync(join(root, "scripts/head-to-head"), ["--out", out, cases], {
		encoding: "utf8",
		stdio: "pipe",
		env: {
			...process.env,
			AGENT_CMD: join(root, "test/fixtures/fake-agent.sh"),
			AGENT_REPORT_CMD: `${join(root, "node_modules/.bin/tsx")} --tsconfig ${join(root, "tsconfig.json")} ${join(root, "src/cli/index.ts")}`,
			GIST_FILE: gist,
		},
	});

	const rows = readFileSync(join(out, "results.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t"));
	expect(rows[0]).toEqual(["case", "arm", "first_draft_valid", "retries", "final_ok", "build_attempts", "duration_s", "cost_usd", "tokens_in+out"]);
	expect(rows[1]?.slice(1)).toEqual(["explain-diff-html", "-", "-", "y", "-", "1.5", "0.0123", "10+20"]);
	expect(rows[2]?.slice(1)).toEqual(["agent-report", "n", "1", "y", "2", "1.5", "0.0123", "10+20"]);
}, 60_000);
