import { createContext, type ReactNode, useContext } from "react";
import type { Markdown } from "../format/index.js";

type Node = Markdown[number];

export const HeadingIds = createContext<WeakMap<object, string>>(new WeakMap());

const SAFE_URL = /^(?:https?:|mailto:|#|\/|\.\/|\.\.\/)/i;

function plainText(node: Node): string {
	if ("value" in node && typeof node.value === "string") return node.value;
	if ("children" in node) return (node.children as Node[]).map(plainText).join("");
	return "";
}

function nodes(list: readonly Node[], headingShift: number): ReactNode[] {
	return list.map((n, i) => <Mdast key={i} node={n} headingShift={headingShift} />);
}

function Mdast({ node, headingShift }: { node: Node; headingShift: number }): ReactNode {
	const ids = useContext(HeadingIds);
	const kids = () => ("children" in node ? nodes(node.children as Node[], headingShift) : null);
	switch (node.type) {
		case "paragraph":
			return <p>{kids()}</p>;
		case "heading": {
			const Tag = `h${Math.min(Math.max(node.depth, headingShift + 1), 6)}` as "h2";
			return <Tag id={ids.get(node)}>{kids()}</Tag>;
		}
		case "text":
			return node.value;
		case "emphasis":
			return <em>{kids()}</em>;
		case "strong":
			return <strong>{kids()}</strong>;
		case "delete":
			return <del>{kids()}</del>;
		case "inlineCode":
			return <code>{node.value}</code>;
		case "break":
			return <br />;
		case "link":
			return SAFE_URL.test(node.url) ? <a href={node.url}>{kids()}</a> : <>{kids()}</>;
		case "image":
			return node.alt ?? "";
		case "list": {
			const Tag = node.ordered ? "ol" : "ul";
			return <Tag {...(node.ordered && node.start != null && node.start !== 1 ? { start: node.start } : {})}>{kids()}</Tag>;
		}
		case "listItem":
			return (
				<li>
					{node.checked != null && <input type="checkbox" checked={node.checked} disabled readOnly />}
					{kids()}
				</li>
			);
		case "blockquote":
			return <blockquote>{kids()}</blockquote>;
		case "code":
			return (
				<pre>
					<code>{node.value}</code>
				</pre>
			);
		case "thematicBreak":
			return <hr />;
		case "table": {
			const [head, ...body] = node.children;
			const cell = (Tag: "th" | "td", row: typeof head) =>
				row?.children.map((c, i) => (
					<Tag key={i} {...(node.align?.[i] ? { style: { textAlign: node.align[i] } } : {})}>
						{nodes(c.children as Node[], headingShift)}
					</Tag>
				));
			return (
				<table>
					<thead>
						<tr>{cell("th", head)}</tr>
					</thead>
					<tbody>
						{body.map((row, i) => (
							<tr key={i}>{cell("td", row)}</tr>
						))}
					</tbody>
				</table>
			);
		}
		case "html":
			return <code>{node.value}</code>;
		default:
			return plainText(node);
	}
}

export function Md({ body, headingShift = 0 }: { body: Markdown; headingShift?: number }) {
	return <>{nodes(body, headingShift)}</>;
}
