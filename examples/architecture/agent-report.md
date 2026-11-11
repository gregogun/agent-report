---
version: 1
title: How agent-report is built
---

agent-report turns one Markdown file into one HTML file. This report explains the code that does it, for a developer who has just cloned the repository. It covers what each directory under `src/` owns, how data moves between them, and two decisions that shape the code.

The diagram shows the modules and the imports between them. Click a box to jump to the section that explains it.

```diagram
boxes:
  - id: cli
    label: CLI
    path: src/cli
    section: The CLI entry point
  - id: format
    label: Format
    path: src/format
    section: Parse and validate
  - id: resolve
    label: Resolve
    path: src/resolve
    section: Resolve against git
  - id: git
    label: Git runner
    path: src/resolve/git.ts
    section: Resolve against git
  - id: render
    label: Render
    path: src/render/index.ts
    section: Render diffs and diagrams
  - id: diagram
    label: Diagram
    path: src/render/diagram.ts
    section: Render diffs and diagrams
  - id: measure
    label: Measurer
    path: src/render/measure.ts
    section: Measure diagram text from a table
  - id: emit
    label: Emit
    path: src/emit
    section: Emit one HTML file
arrows:
  - from: cli
    to: format
  - from: cli
    to: resolve
  - from: cli
    to: render
  - from: cli
    to: emit
  - from: resolve
    to: git
  - from: resolve
    to: format
    kind: loose
  - from: render
    to: resolve
    kind: loose
  - from: render
    to: diagram
  - from: render
    to: emit
  - from: diagram
    to: format
  - from: diagram
    to: measure
  - from: emit
    to: diagram
```

Solid arrows are imports that run at build time. Dashed arrows are imports of types only, which disappear when the code compiles.

## How a build flows

`agent-report build report.md` runs four stages in order. Each stage is a function that takes the previous stage's output and returns a new data shape.

1. `parseReport` in `src/format/index.ts` turns the Markdown into a `Report`, a list of typed blocks.
2. `resolveReport` in `src/resolve/index.ts` runs git for the blocks that need it and returns a `ResolvedReport`.
3. `renderReport` in `src/render/index.ts` turns diffs and diagrams into HTML and SVG and returns a `RenderedReport`.
4. `emitReport` in `src/emit/index.ts` renders the page around those blocks and returns the HTML string.

`src/cli/index.ts` is the only code that calls all four. No stage calls another stage's entry function, so you can read them one at a time.

```callout kind=concept title="Every failure carries a report line"
A failing stage returns `{ ok: false, diagnostics }` instead of throwing. Each `Diagnostic` holds a `position` with the line and column in the report file, a `message`, and an optional `hint`. Blocks keep their `position` from parse through resolve, so a git failure in stage 2 still names the line of the block that caused it.
```

## The CLI entry point

`src/cli/index.ts` reads its arguments with `parseArgs` from `node:util` and supports two commands. `build <report.md> [-o out.html]` runs the pipeline. `reference` prints the format reference and exits.

The build command reads the file, runs the four stages, and writes the HTML. It writes next to the report unless you pass `-o`, and it creates the output directory if it is missing. When a stage fails, `printDiagnostics` prints each diagnostic as `file:line:column message`, prints the hint on the next line, and the process exits with code 1. Nothing is written in that case.

The CLI is also the only place that reads the report file and writes the output file. The stages in between take and return plain data.

## Parse and validate

`src/format` owns the report format. It turns text into blocks and rejects anything malformed. It imports no `node:` module, so parsing never touches the disk or git.

`parseReport` works in three steps.

1. `markdown.ts` builds a syntax tree with remark, with the GitHub-flavored Markdown and frontmatter plugins.
2. `parseFrontmatter` checks the `version` and `title` keys against a zod schema.
3. Each top-level fenced code block whose language is a key of the `registry` in `blocks.ts` becomes a block. Everything between those fences becomes `prose`.

The `registry` holds one entry per block type, which today is `diff`, `callout`, `decision`, `diagram`, and `review-checklist`. An entry has a zod schema for the props on the fence line, a `parseBody` function for the body, and an example. The property tables in the output of `agent-report reference` come from those same zod schemas through `z.toJSONSchema`, so the reference and the validation cannot drift apart.

`headings.ts` indexes the headings of the report, down to `###`, and gives each a slug id. `unknownSections` in `index.ts` uses that index to check every diagram box that has a `section`.

```callout kind=edge-case title="A section link needs exactly one heading"
A box's `section` must match a heading's text, ignoring case and extra whitespace. If no heading matches, parse fails and the hint lists the headings that exist. If two headings have the same text, parse also fails, because the link would have two targets. Rename one of them.
```

## Resolve against git

`src/resolve` is the only stage that runs git. It handles the two block types that point outside the report, `diff` and `diagram`. The other blocks pass through unchanged.

`git.ts` wraps the `git` binary with `execFile`. Every call passes `--literal-pathspecs`, so a path that contains glob characters stays literal. The wrapper exports one function per command it needs, such as `diffFile` and `existsInCommit`, and each returns `{ ok, stdout }` or `{ ok: false, stderr }`. The CLI shells out to the binary instead of using a JavaScript git library, so the build respects the user's git config.

For a `diff` block, `resolveDiff` runs `git diff` for the range and path, selects the requested hunks with `patch.ts`, and anchors each annotation with `anchor.ts`. An annotation that points at a line outside the shown hunks fails the build, and the message says which lines are visible.

For a `diagram` block, `resolveDiagram` checks that every box path exists. It uses `stat` on the working tree, or `git cat-file -e` when the block sets `ref`. It also rejects an absolute path or one containing `..`. When a path is missing, `closest.ts` looks for the nearest real path by edit distance and offers it in the hint.

`resolveReport` does not stop at the first error. It collects the diagnostics of every block, sorts them by line, and returns them together, so an agent can fix several mistakes in one pass.

## Render diffs and diagrams

`src/render/index.ts` turns the blocks that need markup into HTML. It renders all blocks with `Promise.all`.

A diff goes through `preloadPatchDiff` from `@pierre/diffs/ssr`, in unified style with the `pierre-light` and `pierre-dark` themes. The result is wrapped in a `diffs-container` element with a declarative shadow root. Annotation notes go in as slotted children, and the Markdown inside each note is rendered by the `Md` component that `src/emit/markdown.tsx` exports. That import is why the diagram has an arrow from Render to Emit.

A diagram goes through `renderDiagram` in `diagram.ts`. It builds Mermaid flowchart text, one node per box with the label and path on two lines. A `direct` arrow becomes `-->` and a `loose` arrow becomes `-.->`. A box with a `section` gets a `click` line that points at the heading's id. Then it calls `render` from the `pele` package twice. The first call has no width limit. The second sets `maxWidth` to 300, which lays the boxes out in a narrower shape. The page includes both SVGs, and a media query at `40rem` in `src/render/assets/diagram.css` shows one of them.

## Measure diagram text from a table

Pele sizes each box from the width of its label, so the build has to know how wide text is before any browser exists. `src/render/measure.ts` answers that question from a table.

`measurer.width` adds up the advance width of each character, adds the kerning for each adjacent pair, and scales by the font size. The table is `src/render/assets/inter-widths.json`. It covers printable ASCII at Inter's regular weight. A character outside that set gets the width of `n`.

`scripts/build-diagram-font.mjs`, run with `pnpm build:diagram-font`, writes the table and the subsetted font file `inter-diagram.woff2` from the same Inter subset. Both outputs are committed.

```decision title="How does the build measure label text?"
chosen: A committed width table generated from the same Inter subset that the page embeds.
why: |
  The reader's system font is unknown at build time, so a label sized for one font can overflow in another. The report embeds one subsetted Inter and measures with widths taken from that subset, so the box sizes match the text the reader sees. The table is a JSON file, so the published package ships no font library and the build needs no browser.
alternatives:
  - option: Measure with the system font at build time
    reason: Widths differ across operating systems, so the same report would draw differently on each and labels could overflow.
  - option: Measure in a headless browser during the build
    reason: Every build would need a browser installed, and the package is meant to run through `npx` with Node 20 or later and nothing else.
```

```callout kind=warning title="The width table covers only regular weight and ASCII"
The font embedded in the page keeps the weight axis from 400 to 700, but `inter-widths.json` is measured at weight 400. The table has no entry for characters outside printable ASCII, and the measurer falls back to the width of `n` for them. Keep labels in plain ASCII unless you regenerate the table with `pnpm build:diagram-font`.
```

## Emit one HTML file

`src/emit/index.ts` calls `renderToStaticMarkup` on the `Document` component from `Report.tsx` and prepends the doctype. The components exist only at build time, and the report ships no React.

The CSS is inline in a `<style>` tag. `emitReport` reads `styles.css` and, only when the report has a diagram, also takes `diagramCss()` from `src/render/diagram.ts`. That function appends the subsetted font as a base64 `@font-face`. A report without a diagram does not pay for the font. This import is why Emit points at Diagram on the chart.

The only JavaScript in the page is a short inline script that highlights the current heading in the table of contents. Collapsing uses `<details>`. The page makes no network requests, so you can open it from disk or attach it to a message.

```decision title="Why does the build output a pre-rendered page and no client app?"
chosen: Render everything to static HTML in Node and ship no React and no diff JavaScript.
why: |
  The spike in `docs/spikes/pierre-diffs.md` measured about 63 KB for a pre-rendered report against about 1.5 MB of JavaScript to render the diff in the browser. A single file with no scripts also opens from disk and works as an attachment.
alternatives:
  - option: Render the diff in the browser with the client component of @pierre/diffs
    reason: It costs roughly 24 times the bytes, and a single file cannot lazy-load the language grammars without inlining them.
```

```callout kind=warning title="The build copies runtime files into dist"
`emit` and `render` read `styles.css`, `diagram.css`, the woff2 file, and the width table with `new URL("./...", import.meta.url)`. After bundling, those paths resolve inside `dist`. The `build` script in `package.json` therefore copies `src/emit/styles.css` to `dist/styles.css` and `src/render/assets` to `dist/assets`. If you change how the bundle is laid out, move those copies with it.
```

## Where to start reading

To add or change a block type, start at the `registry` in `src/format/blocks.ts`, then add the block's markup in `src/emit/Report.tsx`. To change how a failure reads, find the `Diagnostic` in the stage that produces it. To change how reports look, edit `src/emit/styles.css` and run `pnpm dev`, which rebuilds `fixtures/dev.md` on every change.
