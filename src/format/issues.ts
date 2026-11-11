import type { z } from "zod";

export type Problem = { path: PropertyKey[]; message: string; hint?: string };

type Style = {
	subject: string;
	keyNoun: "prop" | "key";
	addHint(key: string, placeholder: string): string;
};

export const propStyle = (kind: string): Style => ({
	subject: `${kind} block`,
	keyNoun: "prop",
	addHint: (key, placeholder) => `add ${key}=${placeholder}`,
});

export const yamlStyle = (subject: string): Style => ({
	subject,
	keyNoun: "key",
	addHint: (key, placeholder) => `add a line like ${key}: ${placeholder}`,
});

function inner(schema: z.ZodType): z.ZodType {
	const def = schema.def as { type: string; innerType?: z.ZodType };
	return def.innerType && (def.type === "optional" || def.type === "default") ? inner(def.innerType) : schema;
}

function schemaAt(schema: z.ZodType, path: PropertyKey[]): z.ZodType | undefined {
	let current: z.ZodType | undefined = schema;
	for (const key of path) {
		if (!current) return undefined;
		const base = inner(current);
		const def = base.def as { type: string; shape?: Record<string, z.ZodType>; element?: z.ZodType };
		if (def.type === "object" && typeof key === "string") current = def.shape?.[key];
		else if (def.type === "array") current = def.element;
		else return undefined;
	}
	return current;
}

function valueAt(input: unknown, path: PropertyKey[]): unknown {
	let current = input;
	for (const key of path) {
		if (typeof current !== "object" || current === null) return undefined;
		current = (current as Record<PropertyKey, unknown>)[key];
	}
	return current;
}

function pathLabel(path: PropertyKey[]): string {
	return path.map((key, i) => (typeof key === "number" ? `[${key}]` : i === 0 ? String(key) : `.${String(key)}`)).join("");
}

function allowedKeys(schema: z.ZodType | undefined): string {
	const shape = (schema && (inner(schema).def as { shape?: Record<string, z.ZodType> }).shape) ?? {};
	return Object.entries(shape)
		.map(([key, child]) => `${key} (${child.safeParse(undefined).success ? "optional" : "required"})`)
		.join(", ");
}

/*
 * Turns zod issues into messages written for an agent that must fix its own report.
 */
export function problemsFromZod(error: z.ZodError, input: unknown, schema: z.ZodType, style: Style): Problem[] {
	const problems: Problem[] = [];
	for (const issue of error.issues) {
		const path = issue.path;
		const parent = path.length ? ` ${pathLabel(path.slice(0, -1))}` : "";
		const where = `${style.subject}${parent.trim() ? parent : ""}`;
		const name = path.length ? String(path[path.length - 1]) : "";
		const full = pathLabel(path);

		if (issue.code === "unrecognized_keys") {
			const scope = pathLabel(path);
			for (const key of issue.keys) {
				problems.push({
					path: [...path, key],
					message: `${style.subject}${scope ? ` ${scope}` : ""} has unknown ${style.keyNoun} "${key}"`,
					hint: `allowed ${style.keyNoun}s: ${allowedKeys(schemaAt(schema, path))}`,
				});
			}
		} else if (issue.code === "invalid_type" && valueAt(input, path) === undefined && path.length) {
			const placeholder = `<${schemaAt(schema, path)?.description ?? name}>`;
			problems.push({
				path,
				message: `${where} is missing "${name}"`,
				hint: style.addHint(name, placeholder),
			});
		} else if (issue.code === "invalid_type") {
			problems.push({
				path,
				message: path.length
					? `${where} has invalid "${name}": expected ${issue.expected}`
					: `${style.subject} must be ${issue.expected === "object" ? "a mapping of keys to values" : `a ${issue.expected}`}`,
				...(path.length ? {} : { hint: `allowed ${style.keyNoun}s: ${allowedKeys(schema)}` }),
			});
		} else if (issue.code === "invalid_value") {
			problems.push({
				path,
				message: `${where} has invalid ${name} ${JSON.stringify(valueAt(input, path))}`,
				hint: `use one of: ${issue.values.join(", ")}`,
			});
		} else {
			const hint = (issue as { params?: { hint?: string } }).params?.hint;
			problems.push({
				path,
				message: `${where} has invalid ${full || "value"}: ${issue.message}`,
				...(hint ? { hint } : {}),
			});
		}
	}
	return problems;
}
