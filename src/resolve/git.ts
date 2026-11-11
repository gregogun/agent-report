import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";

export type GitResult = { ok: true; stdout: string } | { ok: false; stderr: string; missing: "git" | "cwd" | null };

const BASE = ["-c", "diff.noprefix=false", "-c", "diff.mnemonicPrefix=false", "--literal-pathspecs"];

function run(cwd: string, args: string[]): Promise<GitResult> {
	return new Promise((resolve) => {
		execFile("git", [...BASE, ...args], { cwd, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" }, async (error, stdout, stderr) => {
			if (!error) return resolve({ ok: true, stdout });
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				const cwdExists = await stat(cwd).then(
					() => true,
					() => false,
				);
				return resolve({ ok: false, stderr: "", missing: cwdExists ? "git" : "cwd" });
			}
			resolve({ ok: false, stderr, missing: null });
		});
	});
}

export const repoRoot = (cwd: string) => run(cwd, ["rev-parse", "--show-toplevel"]);

export const diffFile = (cwd: string, range: string, path: string) =>
	run(cwd, ["diff", "--no-color", "--no-ext-diff", range, "--", path]);

export const verifyCommit = (cwd: string, ref: string) => run(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);

export const existsInCommit = (cwd: string, ref: string, path: string) => run(cwd, ["cat-file", "-e", `${ref}:${path}`]);

export const listFiles = (cwd: string, ref: string | null) =>
	ref ? run(cwd, ["ls-tree", "-r", "--name-only", ref]) : run(cwd, ["ls-files"]);
