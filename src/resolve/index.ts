import { stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { Block, Diagnostic, LineRange, Report, Result } from "../format/index.js";
import { anchorAnnotation } from "./anchor.js";
import { closestPath } from "./closest.js";
import { diffFile, existsInCommit, listFiles, repoRoot, verifyCommit } from "./git.js";
import { parsePatch, selectHunks, serializePatch } from "./patch.js";
import type { ResolvedAnnotation, ResolvedBlock, ResolvedReport } from "./types.js";

export type * from "./types.js";

type DiffBlock = Extract<Block, { type: "diff" }>;
type DiagramBlock = Extract<Block, { type: "diagram" }>;

const hunkSelection = (r: LineRange) => (r.start === r.end ? `hunks=${r.start}` : `hunks=${r.start}-${r.end}`);
const firstLine = (text: string) => text.split("\n").find((l) => l.trim()) ?? "no error text";

async function resolveDiff(block: DiffBlock, cwd: string): Promise<Result<ResolvedBlock>> {
	const { range, path, position } = block;
	const fail = (message: string, hint: string): Result<ResolvedBlock> => ({
		ok: false,
		diagnostics: [{ position, message, hint }],
	});

	if (range.startsWith("-")) {
		return fail(`git range "${range}" starts with "-"`, "give a revision range like main..HEAD or HEAD~1..HEAD");
	}
	const git = await diffFile(cwd, range, path);
	if (!git.ok) {
		return fail(
			`git cannot resolve the range "${range}"`,
			`git said: ${firstLine(git.stderr)}. Check the revisions exist in the repo at ${cwd}`,
		);
	}
	if (!git.stdout.trim()) {
		return fail(
			`"${path}" has no changes in ${range}`,
			"check the path is relative to the repo root and that the file changed in this range",
		);
	}
	const files = git.stdout.match(/^diff --git /gm)?.length ?? 0;
	if (files > 1) {
		return fail(`"${path}" matches ${files} changed files in ${range}`, "a diff block shows one file, so give the path of a single file");
	}

	let parsed;
	try {
		parsed = parsePatch(git.stdout);
	} catch (error) {
		return fail(`could not read git's diff output for "${path}": ${(error as Error).message}`, "this is a bug in agent-report, not in the report");
	}
	if (parsed.hunks.length === 0) {
		const binary = parsed.header.some((l) => l.startsWith("Binary files ") || l === "GIT binary patch");
		return binary
			? fail(`"${path}" is a binary file, so there is no diff to show`, "remove this diff block or point it at a text file")
			: fail(
					`"${path}" changed in ${range} but has no line changes`,
					"git reports a rename or mode change only, so there are no lines to show. Remove this diff block",
				);
	}
	const count = parsed.hunks.length;
	if (block.hunks && block.hunks.end > count) {
		return fail(
			`${hunkSelection(block.hunks)} goes past the end, "${path}" has ${count} ${count === 1 ? "hunk" : "hunks"} in ${range}`,
			count === 1 ? "use hunks=1 or leave hunks out to show the whole file diff" : `use hunks between 1 and ${count}, or leave hunks out to show everything`,
		);
	}

	const shown = selectHunks(parsed.hunks, block.hunks);
	const diagnostics: Diagnostic[] = [];
	const annotations: ResolvedAnnotation[] = [];
	for (const annotation of block.annotations) {
		const anchored = anchorAnnotation(annotation, shown);
		if (anchored.ok) annotations.push(anchored.value);
		else diagnostics.push(...anchored.diagnostics);
	}
	if (diagnostics.length) return { ok: false, diagnostics };

	return {
		ok: true,
		value: { type: "diff", range, path, patch: serializePatch(parsed.header, shown), annotations, position },
	};
}

const escapesRoot = (path: string) => isAbsolute(path) || path.split("/").includes("..");

async function resolveDiagram(block: DiagramBlock, root: string): Promise<Diagnostic[]> {
	const { ref, position } = block;
	if (ref !== null) {
		const reason = ref.startsWith("-") ? `git ref "${ref}" starts with "-"` : (await verifyCommit(root, ref)).ok ? null : `git cannot resolve the ref "${ref}"`;
		if (reason) return [{ position, message: reason, hint: `give a branch, tag or commit that exists in this repo, like main or HEAD` }];
	}
	const where = ref === null ? "the working tree" : ref;
	const exists = async (path: string) =>
		ref === null ? stat(join(root, path)).then(() => true, () => false) : (await existsInCommit(root, ref, path)).ok;

	const diagnostics: Diagnostic[] = [];
	for (const box of block.boxes) {
		if (escapesRoot(box.path)) {
			diagnostics.push({ position: box.position, message: `box "${box.id}" path "${box.path}" is outside the repo`, hint: "write the path relative to the repo root, like src/cli" });
			continue;
		}
		if (await exists(box.path)) continue;
		const listed = await listFiles(root, ref);
		const near = listed.ok ? closestPath(box.path, listed.stdout.split("\n").filter(Boolean)) : null;
		diagnostics.push({
			position: box.position,
			message: `box "${box.id}" points at "${box.path}", which does not exist in ${where}`,
			hint: near ? `did you mean "${near}"?` : "write the path of a file or directory relative to the repo root",
		});
	}
	return diagnostics;
}

export async function resolveReport(report: Report, opts: { cwd: string }): Promise<Result<ResolvedReport>> {
	const needsRepo = report.blocks.filter((b): b is DiffBlock | DiagramBlock => b.type === "diff" || b.type === "diagram");
	let root = opts.cwd;
	if (needsRepo[0]) {
		const probe = await repoRoot(opts.cwd);
		if (!probe.ok) {
			const message =
				probe.missing === "git"
					? "git is not installed or not on PATH"
					: probe.missing === "cwd"
						? `the directory ${opts.cwd} does not exist`
						: `${opts.cwd} is not inside a git repository`;
			return {
				ok: false,
				diagnostics: [{ position: needsRepo[0].position, message, hint: "run agent-report from the repo that holds the diffs and diagrams, or from a subdirectory of it" }],
			};
		}
		root = probe.stdout.trim();
	}

	const diagnostics: Diagnostic[] = [];
	const blocks: ResolvedBlock[] = [];
	for (const block of report.blocks) {
		if (block.type === "diagram") {
			diagnostics.push(...(await resolveDiagram(block, root)));
			blocks.push(block);
			continue;
		}
		if (block.type !== "diff") {
			blocks.push(block);
			continue;
		}
		const resolved = await resolveDiff(block, root);
		if (resolved.ok) blocks.push(resolved.value);
		else diagnostics.push(...resolved.diagnostics);
	}
	if (diagnostics.length) {
		diagnostics.sort((a, b) => a.position.line - b.position.line || a.position.column - b.position.column);
		return { ok: false, diagnostics };
	}
	return { ok: true, value: { version: report.version, title: report.title, blocks } };
}
