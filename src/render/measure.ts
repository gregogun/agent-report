import { readFileSync } from "node:fs";

export type TextMeasurer = { width(text: string, size: number, style: number): number };

type WidthTable = { em: number; adv: Record<string, number>; kern: Record<string, number> };

const table: WidthTable = JSON.parse(readFileSync(new URL("./assets/inter-widths.json", import.meta.url), "utf8"));

const fallback = table.adv["n"] ?? 0;

export const measurer: TextMeasurer = {
	width(text, size) {
		let units = 0;
		let prev = "";
		for (const ch of text) {
			units += table.adv[ch] ?? fallback;
			units += table.kern[prev + ch] ?? 0;
			prev = ch;
		}
		return (units / table.em) * size;
	},
};
