import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { RenderedReport } from "../render/index.js";
import { Document } from "./Report.js";

const stylesheet = () => readFileSync(new URL("./styles.css", import.meta.url), "utf8");

export function emitReport(report: RenderedReport): string {
	return `<!doctype html>${renderToStaticMarkup(Document({ report, css: stylesheet() }))}`;
}
