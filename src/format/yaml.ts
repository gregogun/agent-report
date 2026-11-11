import { isNode, LineCounter, parseDocument } from "yaml";
import type { Diagnostic } from "./types.js";

export type YamlRead = {
	value: unknown;
	errors: Diagnostic[];
	lineOf(path: PropertyKey[]): number;
};

export function readYaml(text: string, firstLine: number, label: string): YamlRead {
	const lines = new LineCounter();
	const doc = parseDocument(text, { lineCounter: lines });

	const errors = doc.errors.map((error): Diagnostic => {
		const at = error.linePos?.[0];
		return {
			position: { line: firstLine + (at?.line ?? 1) - 1, column: at?.col ?? 1 },
			message: `${label} is not valid YAML: ${error.message.split("\n")[0]?.replace(/ at line \d+, column \d+:?$/, "")}`,
			hint: "check indentation, and quote strings that contain a colon",
		};
	});

	const lineOf = (path: PropertyKey[]): number => {
		const keys = path.filter((key): key is string | number => typeof key !== "symbol");
		for (let length = keys.length; length >= 0; length--) {
			const node = doc.getIn(keys.slice(0, length), true);
			const start = isNode(node) ? node.range?.[0] : undefined;
			if (start !== undefined) return firstLine + lines.linePos(start).line - 1;
		}
		return firstLine;
	};

	return { value: errors.length ? undefined : doc.toJS(), errors, lineOf };
}
