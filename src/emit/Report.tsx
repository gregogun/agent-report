import type { ReactNode } from "react";
import type { RenderedBlock, RenderedReport } from "../render/index.js";
import { Md } from "./markdown.js";

type Of<T extends RenderedBlock["type"]> = Extract<RenderedBlock, { type: T }>;

function Diff({ block }: { block: Of<"diff"> }) {
	return (
		<figure className="diff">
			<figcaption>
				<code>{block.path}</code>
				<span className="range">{block.range}</span>
			</figcaption>
			<div dangerouslySetInnerHTML={{ __html: block.html }} />
		</figure>
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

export function Document({ report, css }: { report: RenderedReport; css: string }) {
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
				<main>
					<h1>{report.title}</h1>
					{report.blocks.map((block, i) => (
						<Block key={i} block={block} />
					))}
				</main>
			</body>
		</html>
	);
}
