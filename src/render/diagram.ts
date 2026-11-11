import { readFileSync } from "node:fs";
import { render } from "pele";
import type { DiagramArrow, DiagramBox } from "../format/index.js";
import { measurer } from "./measure.js";
import type { RenderedDiagram } from "./types.js";

export const DIAGRAM_FONT = "ARDiagram";

export const diagramCss = () => {
	const styles = readFileSync(new URL("./assets/diagram.css", import.meta.url), "utf8");
	const woff2 = readFileSync(new URL("./assets/inter-diagram.woff2", import.meta.url)).toString("base64");
	return `${styles}@font-face{font-family:${DIAGRAM_FONT};src:url(data:font/woff2;base64,${woff2}) format("woff2");font-weight:400 700;font-style:normal}\n`;
};

type DiagramInput = { boxes: DiagramBox[]; arrows: DiagramArrow[]; position: RenderedDiagram["position"] };

const ARROW = { direct: "-->", loose: "-.->" } as const;

const entities: [RegExp, string][] = [
	[/#/g, "#35;"],
	[/"/g, "#quot;"],
	[/`/g, "#96;"],
	[/</g, "#lt;"],
	[/>/g, "#gt;"],
	[/\s+/g, " "],
];

const quoted = (label: string) => `"${entities.reduce((text, [pattern, entity]) => text.replace(pattern, entity), label).trim()}"`;

export function diagramMermaid({ boxes, arrows }: Pick<DiagramInput, "boxes" | "arrows">): string {
	const node = new Map(boxes.map((box, i) => [box.id, `b${i}`]));
	return [
		"flowchart LR",
		...boxes.map((box) => `  ${node.get(box.id)}[${quoted(box.label)}]`),
		...arrows.map((arrow) => `  ${node.get(arrow.from)} ${ARROW[arrow.kind]} ${node.get(arrow.to)}`),
	].join("\n");
}

export function renderDiagram(diagram: DiagramInput, index: number): RenderedDiagram {
	const { svg } = render(diagramMermaid(diagram), { measurer, fontFamily: `${DIAGRAM_FONT}, sans-serif`, idPrefix: `d${index}` });
	return { type: "diagram", svg, position: diagram.position };
}
