# Spike: @pierre/diffs pre-render in Node (v1.6.4)

Labels: [M] measured, [I] inferred from reading code, [G] guess.
Files: `render.mjs` (prerender dump), `build.mjs` (builds `report.html`), `shot.mjs` (playwright), `sample.patch` (real `git diff` from `repo/`, 31-line a.ts changed in two places), `screenshot-light.png`, `screenshot-dark.png`.

## 1. Pre-render in plain Node: yes
[M] `@pierre/diffs/ssr` exports `preloadPatchDiff`, `preloadFileDiff`, `preloadMultiFileDiff`, `preloadDiffHTML`, `renderHTML`. It runs in plain Node 20+ with no DOM and no jsdom (package has no required deps on react for this path).
```js
import { preloadPatchDiff } from '@pierre/diffs/ssr';
const r = await preloadPatchDiff({ patch /* git diff text, single file */, annotations,
  options: { theme: { dark: 'pierre-dark', light: 'pierre-light' }, diffStyle: 'unified' } });
r.prerenderedHTML // string, 62,481 bytes for the sample
```
[M] Input is the raw `git diff` text. `patch` must be a single-file patch (it calls `getSingularPatch`) [I]; multi-file diffs need splitting per file first (or `parsePatchFiles` + `preloadFileDiff`, not tried). Alternative: `preloadMultiFileDiff({oldFile,newFile})` takes file contents.

## 2. Line annotations
[M] `DiffLineAnnotation<T> = { side: 'additions'|'deletions', lineNumber: number, metadata: T }`. Anchored by side plus line number in that side's own numbering (new-file numbers for additions, old-file for deletions) [M: additions 5 and 24 landed under new lines 5 and 24]. `lineNumber: 0` = file-level annotation above first hunk [I, d.ts doc]. Passed as `annotations` to `preload*`.
[M] The library does NOT render annotation content in the pre-render. It emits `<slot name="annotation-{side}-{line}">` inside the shadow DOM (e.g. `annotation-additions-5`, via `getLineAnnotationName`). You supply the content as light-DOM children of the host: `<div slot="annotation-additions-5">...</div>`. So annotation content is plain HTML you render yourself in Node (any HTML, even Markdown-rendered). No client React/DOM needed. [M] Worked with 2 annotations; see screenshots. React's `renderAnnotation` path does the same via `renderToString` into slotted divs (`ssr/FileDiffReact.js`) [I].
Range / quoted-text anchoring (spec's authoring syntax) is not in the library; the resolve stage must map those to a single side+line [I]. Annotations render below their line.

## 3. Static or needs JS?
[M] Static HTML+CSS suffices to look right, via declarative shadow DOM. The prerendered string is the shadow root's *contents* (sprite svg, `<style data-core-css>`, `<style data-theme-css>`, `<pre>`), not the host. You wrap it:
```html
<diffs-container><template shadowrootmode="open">${prerenderedHTML}</template><div slot="annotation-additions-5">...</div></diffs-container>
```
[M] Final page has 0 `<script>` tags, `customElements.get('diffs-container')` is undefined, yet shadowRoot exists with 17 `[data-line]` lines, and screenshots render correctly (syntax colors, intra-line word highlights, light and dark). Requires a browser with declarative shadow DOM (Chrome 111+, Safari 16.4+, Firefox 123+) [I from general knowledge].
[M] Without JS, interactive bits are inert: the "N unmodified lines" separators render but are not expandable; hover/selection don't work. The markup carries `data-dehydrated`, meaning the client component can hydrate it [I]. Hydration was not tested.
Theming [M]: theme colors are emitted as `--diffs-*` custom properties in the theme `<style>`; light/dark switch via `light-dark()` + `prefers-color-scheme` (screenshots confirm both). 101 distinct `--diffs-*` names appear in `dist/style.js`. Documented override hooks on the host: `--diffs-font-family`, `--diffs-font-size`, `--diffs-line-height`, `--diffs-tab-size`, `--diffs-gap-inline/block`, `--diffs-bg-*-override` (addition/deletion/context/buffer/separator/hover/selection), `--diffs-addition-color-override`, `--diffs-deletion-color-override`, `--diffs-modified-color-override`, `--diffs-fg-number-override`, `--diffs-light-bg`/`--diffs-dark-bg` etc. [M: names grepped; only `--diffs-font-size` and `--diffs-addition-color-override` set in report.html, and annotation `.note` styling from the outer page worked]. Custom themes: pass `theme` name or a Shiki theme object [I]; `unsafeCSS` option injects extra CSS [I].
Unrelated gotcha [M]: the prerender outputs page-wide `light-dark` colors from `color-scheme`; set `:root{color-scheme:light dark}` on the host page so annotations and page chrome match.

## 4. Single self-contained HTML
[M] `report.html`: 63,249 bytes total (gzip 10,381 bytes), 0 scripts, no external refs. Opened via `file://` in headless Chromium (playwright 1.x, chromium-headless-shell 1254): the only request logged was the file itself, i.e. zero network requests.
Breakdown of the 62,481-byte prerender [M, regex-measured]: SVG icon sprite 15,818 (25%, 36 symbols, mostly unused here), two `<style>` blocks 32,606 (52%; library core CSS plus theme CSS), diff markup (`<pre>`) 13,573 (22%, scales with diff size), remainder ~0.5k. Shiki grammars/themes: 0 bytes shipped, they are used only inside Node at build time. Wrapper/page/annotations ~0.8k.
Fixed overhead ~48 KB (sprite+CSS) per diff. [I] Per additional diff block it would repeat unless the sprite and core CSS are deduplicated (core CSS is same for every diff; theme CSS too). A single shared `adoptedStyleSheets`/dedupe is not offered by the API; you could hoist one copy yourself by string-splitting the `<style>` tags [G, untested].

## 5. React component and client cost
[M] `@pierre/diffs/react` exports `PatchDiff`, `FileDiff`, `MultiFileDiff`, `File`, `CodeView`, `UnresolvedFile`, `WorkerPoolContextProvider`, etc. `renderAnnotation` prop for annotation content; `lineAnnotations` prop.
Measured with esbuild `--bundle --minify`, a minimal `createRoot(...).render(<PatchDiff .../>)`, production env:
- React + react-dom alone: 222,693 B.
- Single-bundle: 11,461,251 B (esbuild inlines every Shiki grammar via dynamic imports, ~480 lang chunks). Unusable as one file.
- Split: entry `client.js` 514,486 B (144,735 gz) plus a shared 785 KB chunk (53 KB gz) plus a 212 KB Oniguruma wasm chunk (159 KB gz, loaded as JS-embedded wasm), plus per-language chunks (typescript, tsx, etc.) lazily fetched at runtime. Initial JS ~1.5 MB raw, ~360 KB gz, before any grammar, and the highlighter is async (grammar loaded after first paint) [M sizes; load order I].
So client-side rendering costs roughly 1.5 MB raw (~0.36 MB gz) of JS before grammars, vs 63 KB raw (10 KB gz) for the whole pre-rendered report (about 35x gz, 24x raw) [M, derived]. A single-file HTML cannot lazy-load language chunks without inlining them [I]. (The bundle test source client.jsx was deleted after measuring.)

## Recommendation: pre-render in Node (render stage), ship no diff JS
1. Render stage: `preloadPatchDiff` per file, wrap in `<diffs-container><template shadowrootmode="open">`, put annotation HTML in `slot="annotation-{side}-{line}"` light-DOM children. All server-side, matches spec pipeline step 4 (confirmed supported).
2. Viewer (React) treats diff blocks as opaque pre-rendered HTML (inject via `dangerouslySetInnerHTML` from the JSON tree; note React/innerHTML does NOT execute declarative shadow DOM `<template shadowrootmode>`, so [I, important] either the viewer's initial HTML must carry the markup before parse, or attach the shadow root manually: `host.attachShadow({mode:'open'}).innerHTML = html`; untested here, test in the next ticket). Raw `<template shadowrootmode>` in static HTML (as tested) is fine.
3. Cost is ~48 KB fixed per diff (sprite+CSS); dedupe if many diffs per report. Expect lost: expandable context and hover/selection unless hydrating; the hybrid (add `@pierre/diffs` web-component + minimal JS for expansion) was not measured and would need a bundle with a restricted language set. Start pure-static, revisit if reviewers need expandable context.
4. Open risks: single-file patch only per call; multi-file diffs need splitting; annotation range/quote anchoring must be resolved to side+line by our code; theme names beyond pierre-light/dark untested.

## Addendum (ticket 6): can one copy of the CSS and sprite serve every diff block?
Measured on `fixtures/dev.md`, two diff blocks, via `preloadPatchDiff` and a playwright run. Labels as above.

- [M] The icon sprite (15,818 B per block) is referenced by exactly one `<use>`, in the library's file header. With `disableFileHeader: true` nothing references it, so the render stage drops it. Zero client JS, saves 15.8 KB per block. A `<use href="#id">` cannot reach across shadow roots in any case, so hoisting the sprite to the document would not have worked.
- [M] The core CSS (31,537 B) and the theme CSS (1,069 B) are byte-identical across blocks for a given theme.
- [M] One shared sheet works only with JavaScript. Variant: core CSS stripped from every block and held once in the head, plus a 3-line inline script that does `shadowRoot.adoptedStyleSheets = [sheet]` per `diffs-container`. With JS the layout and colors were identical to the original (container heights 1308 and 509 px, same addition background). With JS off the diffs lose all styling (heights 2659 and 1015 px, transparent line backgrounds). Declarative shadow DOM has no stylesheet sharing without script, and `<link>` or `@import` would break the single-file rule.
- [M] Sizes for the two-diff fixture (whole page): 155,277 B originally (28,184 gzip). Sprite dropped: 123,641 B (21,741 gzip). Shared sheet with the sprite still present: 123,962 B (22,695 gzip). So the shared sheet would save about 31 KB raw on top of the sprite drop, but only about 5.5 KB gzip.
- Decision: not implemented. Savings are about 31 KB raw per extra block, nearly free after gzip, and the price is unstyled diffs in any viewer that strips scripts (mail previews, Quick Look, code-review file viewers). Revisit if reports routinely carry more than about eight diffs, with the sheet kept inline in the first block as the no-JS fallback.
- Untested [G]: rendering the diff in light DOM with the core CSS rewritten from `:host` to `diffs-container` would share one sheet with no JS, but it lets page CSS leak into the diff and requires rewriting library output, so it was not tried.
