#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { emitReport } from "../emit/index.js";
import { type Diagnostic, parseReport } from "../format/index.js";
import { formatReference } from "../format/reference.js";
import { renderReport } from "../render/index.js";
import { resolveReport } from "../resolve/index.js";

const USAGE = [
	"usage:",
	"  agent-report build <report.md> [-o out.html]   render a report to one HTML file",
	"  agent-report reference                         print the report format reference",
].join("\n");

function printDiagnostics(file: string, diagnostics: Diagnostic[]): number {
	for (const d of diagnostics) {
		console.error(`${file}:${d.position.line}:${d.position.column} ${d.message}`);
		if (d.hint) console.error(`  ${d.hint}`);
	}
	return 1;
}

async function build(file: string, out: string | undefined): Promise<number> {
	let source: string;
	try {
		source = await readFile(file, "utf8");
	} catch {
		console.error(`cannot read ${file}`);
		return 1;
	}
	const parsed = parseReport(source);
	if (!parsed.ok) return printDiagnostics(file, parsed.diagnostics);
	const resolved = await resolveReport(parsed.value, { cwd: dirname(resolve(file)) });
	if (!resolved.ok) return printDiagnostics(file, resolved.diagnostics);
	const html = emitReport(await renderReport(resolved.value));
	const target = out ?? join(dirname(file), `${basename(file, extname(file))}.html`);
	await mkdir(dirname(resolve(target)), { recursive: true });
	await writeFile(target, html);
	console.log(`wrote ${target} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
	return 0;
}

async function main(argv: string[]): Promise<number> {
	let args;
	try {
		args = parseArgs({ args: argv, allowPositionals: true, options: { output: { type: "string", short: "o" }, help: { type: "boolean", short: "h" } } });
	} catch (error) {
		console.error(`${(error as Error).message}\n${USAGE}`);
		return 1;
	}
	const [command, file, ...extra] = args.positionals;
	if (args.values.help || !command) {
		(args.values.help ? console.log : console.error)(USAGE);
		return args.values.help ? 0 : 1;
	}
	if (command === "reference" && !file) {
		process.stdout.write(formatReference());
		return 0;
	}
	if (command !== "build" || !file || extra.length) {
		console.error(USAGE);
		return 1;
	}
	return build(file, args.values.output);
}

process.exitCode = await main(process.argv.slice(2));
