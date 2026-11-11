import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { diagramCss } from "../render/diagram.js";
import type { RenderedReport } from "../render/index.js";
import { Document } from "./Report.js";

const stylesheet = () => readFileSync(new URL("./styles.css", import.meta.url), "utf8");

export function emitReport(report: RenderedReport): string {
	const hasDiagram = report.blocks.some((b) => b.type === "diagram");
	const css = hasDiagram ? `${stylesheet()}\n${diagramCss()}` : stylesheet();
	return `<!doctype html>${renderToStaticMarkup(Document({ report, css }))}`;
}
