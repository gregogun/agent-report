import type { ReactNode } from "react";
import type { RenderedBlock, RenderedReport } from "../render/index.js";
import { HeadingIds, Md } from "./markdown.js";
import { headingIndex, type TocEntry } from "./toc.js";

type Of<T extends RenderedBlock["type"]> = Extract<RenderedBlock, { type: T }>;

function Diff({ block }: { block: Of<"diff"> }) {
	const cut = block.path.lastIndexOf("/") + 1;
	return (
		<details className="diff" open>
			<summary>
				<span className="diff-path">
					<span className="diff-dir">{block.path.slice(0, cut)}</span>
					<span className="diff-file">{block.path.slice(cut)}</span>
				</span>
				<span className="diff-meta">
					<span className="diff-range">{block.range}</span>
					<span className="diff-add">+{block.added}</span>
					<span className="diff-del">&minus;{block.removed}</span>
					{block.notes > 0 && (
						<span className="diff-notes">
							{block.notes} {block.notes === 1 ? "note" : "notes"}
						</span>
					)}
				</span>
			</summary>
			<div className="diff-body" dangerouslySetInnerHTML={{ __html: block.html }} />
		</details>
	);
}

function Callout({ block }: { block: Of<"callout"> }) {
	return (
		<aside className={`callout callout-${block.kind}`}>
			<p className="callout-title">{block.title ?? block.kind.replace("-", " ")}</p>
			<Md body={block.body} />
		</aside>
	);
}

function Decision({ block }: { block: Of<"decision"> }) {
	return (
		<section className="decision">
			<p className="decision-label">Decision</p>
			<h3>{block.title}</h3>
			<div className="decision-chosen">
				<Md body={block.chosen} />
			</div>
			<h4>Why</h4>
			<Md body={block.why} />
			{block.alternatives.length > 0 && (
				<>
					<h4>Alternatives considered</h4>
					<ul>
						{block.alternatives.map((alt, i) => (
							<li key={i}>
								<strong>{alt.option}</strong>
								<Md body={alt.reason} />
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
}

function Checklist({ block }: { block: Of<"review-checklist"> }) {
	return (
		<section className="checklist">
			<p className="checklist-title">Review closely</p>
			<ul>
				{block.items.map((item, i) => (
					<li key={i}>
						<span className="box" aria-hidden="true" />
						<div>
							<Md body={item} />
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

function Block({ block }: { block: RenderedBlock }): ReactNode {
	switch (block.type) {
		case "prose":
			return (
				<div className="prose">
					<Md body={block.body} headingShift={1} />
				</div>
			);
		case "diff":
			return <Diff block={block} />;
		case "callout":
			return <Callout block={block} />;
		case "decision":
			return <Decision block={block} />;
		case "review-checklist":
			return <Checklist block={block} />;
	}
}

const tocScript = `(() => {
	const nav = document.querySelector(".toc");
	if (!nav) return;
	const wide = matchMedia("(min-width: 68rem)");
	nav.open = wide.matches;
	wide.addEventListener("change", (e) => (nav.open = e.matches));
	const links = [...nav.querySelectorAll("a")];
	const heads = links.map((a) => document.getElementById(a.hash.slice(1)));
	let queued = false;
	const spy = () => {
		queued = false;
		let at = 0;
		heads.forEach((h, i) => { if (h.getBoundingClientRect().top < innerHeight * 0.3) at = i; });
		links.forEach((a, i) => (i === at ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current")));
	};
	addEventListener("scroll", () => queued || (queued = true, requestAnimationFrame(spy)), { passive: true });
	spy();
})();`;

function Contents({ entries }: { entries: TocEntry[] }) {
	if (entries.length < 2) return null;
	return (
		<nav aria-label="Contents">
			<details className="toc" open>
				<summary>Contents</summary>
				<ol>
					{entries.map((e) => (
						<li key={e.id} className={`toc-${e.level}`}>
							<a href={`#${e.id}`}>{e.text}</a>
						</li>
					))}
				</ol>
			</details>
		</nav>
	);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Meta({ blocks }: { blocks: RenderedBlock[] }) {
	const diffs = blocks.filter((b): b is Of<"diff"> => b.type === "diff");
	const notes = diffs.reduce((n, d) => n + d.notes, 0);
	const decisions = blocks.filter((b) => b.type === "decision").length;
	const facts = [diffs.length && plural(diffs.length, "diff"), notes && plural(notes, "note"), decisions && plural(decisions, "decision")].filter(Boolean);
	return facts.length ? <p className="meta">{facts.join(" \u00b7 ")}</p> : null;
}

export function Document({ report, css }: { report: RenderedReport; css: string }) {
	const { entries, ids } = headingIndex(report.blocks);
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="color-scheme" content="light dark" />
				<title>{report.title}</title>
				<style dangerouslySetInnerHTML={{ __html: css }} />
			</head>
			<body>
				<div className="page">
					<header className="masthead">
						<p className="eyebrow">Report</p>
						<h1>{report.title}</h1>
						<Meta blocks={report.blocks} />
					</header>
					<Contents entries={entries} />
					<HeadingIds value={ids}>
						<main>
							{report.blocks.map((block, i) => (
								<Block key={i} block={block} />
							))}
						</main>
					</HeadingIds>
				</div>
				<script dangerouslySetInnerHTML={{ __html: tocScript }} />
			</body>
		</html>
	);
}
