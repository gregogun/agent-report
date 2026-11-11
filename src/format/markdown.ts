import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Markdown } from "./types.js";

const reportProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml"]);
const snippetProcessor = unified().use(remarkParse).use(remarkGfm);

export function parseReportTree(source: string) {
	return reportProcessor.parse(source);
}

/*
 * Positions inside the returned nodes are relative to `text`, not the report.
 */
export function parseMarkdown(text: string): Markdown {
	return snippetProcessor.parse(text).children;
}
