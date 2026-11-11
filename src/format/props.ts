import type { Problem } from "./issues.js";

const PAIR = /\s*([A-Za-z][\w-]*)=(?:"([^"]*)"|(\S+))/y;

/*
 * Splits an info string like `path=src/a.ts note="two words"` into key/value pairs.
 */
export function tokenizeProps(meta: string, kind: string): { props: Record<string, string>; problems: Problem[] } {
	const props: Record<string, string> = {};
	const problems: Problem[] = [];
	let at = 0;
	while (at < meta.length) {
		PAIR.lastIndex = at;
		const match = PAIR.exec(meta);
		if (!match) {
			const rest = meta.slice(at).trim();
			if (!rest) break;
			const word = rest.split(/\s+/)[0] ?? rest;
			problems.push({
				path: [],
				message: `${kind} block has unreadable props text "${word}"`,
				hint: 'write props as key=value, or key="value with spaces"',
			});
			at = meta.indexOf(word, at) + word.length;
			continue;
		}
		const key = match[1] as string;
		if (key in props) {
			problems.push({
				path: [],
				message: `${kind} block repeats prop "${key}"`,
				hint: `give "${key}" once`,
			});
		} else {
			props[key] = match[2] ?? match[3] ?? "";
		}
		at = PAIR.lastIndex;
	}
	return { props, problems };
}
