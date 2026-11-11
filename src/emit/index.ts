import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { RenderedReport } from "../render/index.js";
import { Document } from "./Report.js";

/* Resolves next to src/emit/ under tsx and next to dist/index.mjs once built (the build script copies it). */
const stylesheet = () => readFileSync(new URL("./styles.css", import.meta.url), "utf8");

export function emitReport(report: RenderedReport): string {
	return `<!doctype html>${renderToStaticMarkup(Document({ report, css: stylesheet() }))}`;
}
