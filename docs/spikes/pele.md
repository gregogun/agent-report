# Spike: Pele diagram rendering in Node (pele 1.13.0)

Labels: [M] measured, [I] inferred from reading code, [G] guess.
Files: `diagram.mmd` (the agent-report architecture, 11 nodes and 11 edges), `build.mjs` (renders it and builds `report.html` with React `renderToStaticMarkup`), `shot.mjs` (playwright), `probe*.mjs` (size, determinism, class, link, and font checks), `screenshot-light.png`, `screenshot-dark.png`, `screenshot-375.png`. All in `spikes/pele/`, which is gitignored. The light screenshot is copied to `docs/spikes/pele-light.png`.

The decision: can Pele turn a diagram description into static SVG in Node, with no browser and no client JavaScript, so a future "visualise" mode fits the single-file pipeline? The answer is yes. Pele exists, so no fallback renderer was tried.

## 1. What Pele is
[M] Pele is real. The npm package is `pele` 1.13.0, licence MIT (the `LICENSE` file and `package.json` agree). The repo is `github.com/obsidianmd/pele`, author `kepano`. `github.com/kepano/pele` redirects to it, so both earlier guesses at the name were half right. Searched: `npm view` for `pele`, `@kepano/pele`, `@obsidianmd/pele`, `pele-diagram`, `pele-js` (only `pele` exists), and the GitHub API for `kepano/pele`, `obsidianmd/pele`, and the repo list of `kepano`. The web search tool was not needed.
[M] It is a Mermaid renderer. The input is Mermaid text, and the README says it covers every diagram type in Mermaid 12.1.0 with its own layout and visual style. The output is an SVG string plus `width`, `height`, and a `links` array. It has no runtime dependencies, and the installed package is 3.7 MB on disk (`engines.node >= 20`).
[M] The repo was created 2026-10-05 and last pushed 2026-10-31, and the GitHub licence field reads "Other" (NOASSERTION) even though the file is MIT. The project is five weeks old at the time of the spike.

## 2. Renders in plain Node: yes
[M] No jsdom and no browser. `typeof window` and `typeof document` are both `undefined` in the script, and the call is synchronous.
```js
import { render } from 'pele';
const { svg, width, height, links } = render(mermaidText, { idPrefix: 'w' });
// svg: string, 7,052 bytes for the sample. width 1186, height 270.
```
[M] One render took 11 ms (single run, includes first-call warmup). Two renders of the same text produced byte-identical SVG.
[M] Text widths come from a built-in font-metrics table in Node, not from a real font (`defaultMeasurer` in `text/measurer.d.ts`). See the risk in the Verdict.

## 3. Static output: yes, layout happens at build time
[M] The SVG has 0 `<script>` tags, 0 `<style>` tags, and no `@media` rules. The page holds 0 scripts, and the only network request in headless Chromium over `file://` was the page itself. There were no console errors.
[M] All 11 nodes and 11 edges drew, and every label fit its box with the page's `ui-sans-serif` stack.
[M] Pele fixes the layout when it renders. Passing `maxWidth: 340` re-lays the diagram out as a 455 by 676 SVG, where the default is 1186 by 270. `responsive` and `autoDirection` changed nothing in Node, because they act only in the browser through `mount()` [I]. So a diagram that must read on a phone needs two renders. The spike embeds both and swaps them with a 640px media query. The 375px screenshot shows the narrow one at 309px wide with no horizontal page scroll.

## 4. Size
[M] Wide diagram, 11 nodes: 7,052 bytes raw, 1,647 gzipped. Narrow variant: 6,981 raw, 1,607 gzipped. The whole test page with both variants and its CSS is 15,614 raw and 2,962 gzipped.
[M] What drives it, by byte count of the wide SVG: node markup 3,762 (53%), edge path data 2,583 (37%), the `<svg>` header 707 (10%). The header is the CSS-variable prelude (`--_bg:var(--pele-bg,#fff)` and so on) plus accessibility attributes. Fonts cost nothing, since the text is real `<text>` and the font is whatever the page says. No CSS is inlined.
[M] Scaling, checked with a synthetic 22-node ring: 12,624 raw and 1,772 gzipped. Doubling the nodes added 79% raw and only 125 bytes gzipped, because node and edge markup repeats. Limiter: coordinates in path data and `transform` values are the only high-entropy bytes. Compare the 48 KB fixed overhead per diff in `docs/spikes/pierre-diffs.md`. A diagram is cheap by comparison.
[M] The 22-node case used short labels, so real labels will gzip slightly worse.

## 5. Node identity: ids yes, path verification no
[M] Every node is `<g class="pele-node pele-shape-rect" data-id="resolve">` with the Mermaid id as `data-id`, and every edge is `data-id="L_resolve_render_0"`. A Mermaid `click resolve href "#section-resolve"` wraps the node in a real `<a href>`, and `click A href "src/resolve/index.ts" "tooltip"` adds a `<title>`. The `links` array returns `{ id, href, internal }` per link. In Chromium, clicking the `resolve` node moved `location.hash` to `#section-resolve`, so linking a node to a report section works with no script.
[M] `click B href "javascript:alert(1)"` produced no `<a>` and no entry in `links`, so unsafe schemes are dropped.
[I] Pele knows nothing about repos. It only carries ids and links through. To verify "each node points at a real path", the build needs the node-to-path mapping as data it can check, such as a typed `nodes` list of `{ id, label, path }` that agent-report validates in the resolve stage and then turns into Mermaid text. Free-form Mermaid text from the agent has only labels, and checking a label such as "src/resolve" would mean parsing it by hand.
[M] Duplicate `data-id` values appear when two SVG variants share a page. These are attributes, not DOM ids, so nothing breaks. Anything that looks nodes up by `data-id` must scope to a variant.

## 6. Theming: yes, through CSS variables
[M] Pele reads `--pele-bg`, `--pele-fg`, `--pele-muted`, `--pele-line`, `--pele-surface`, `--pele-surface-alt`, `--pele-border`, `--pele-accent`, `--pele-font`, and `--pele-radius` (with fallbacks) at paint time. The spike maps them to agent-report tokens in one rule.
```css
.pele{--pele-bg:var(--card);--pele-fg:var(--fg);--pele-line:var(--muted);--pele-surface:var(--surface);
--pele-surface-alt:var(--rule);--pele-border:var(--rule);--pele-accent:var(--voice);--pele-font:var(--font-ui)}
```
[M] With `:root{color-scheme:light dark}` and `light-dark()` tokens copied from `src/emit/styles.css`, the node fill computed to `rgb(241, 238, 229)` in light and `rgb(33, 33, 37)` in dark, with no re-render. Screenshots: `screenshot-light.png` (also `docs/spikes/pele-light.png`) and `screenshot-dark.png`.
[M] Per-node colour needs care. `classDef hot fill:var(--c-note)` is a parse error, because the parser rejects parentheses in style values. A literal colour in `classDef` is inlined on the node and does not follow dark mode. What works is `classDef hot stroke-width:2px` (or any harmless property) to put a `hot` class on the node, then page CSS such as `.pele-node.hot rect{fill:light-dark(#f0f1ff,#20213a)}`. That computed to `rgb(240, 241, 255)` in light and `rgb(32, 33, 58)` in dark.

## 7. Fit inside renderToStaticMarkup: yes
[M] `build.mjs` injects each SVG with `h('div', { dangerouslySetInnerHTML: { __html: svg } })` and calls `renderToStaticMarkup` (React 19.3.1 from the project root). The result is plain inline `<svg>` markup, so the page parses it with no further steps. This differs from the diff blocks, whose declarative shadow DOM does not survive `innerHTML`.
[I] This does not breach the "No raw HTML" decision. The agent supplies a diagram description, and the build produces the markup. Pele escapes diagram text and filters links, but only the `javascript:` case was tested.

## Verdict
Yes. Pele renders agent-report's own architecture diagram to static SVG in plain Node, in 11 ms and 1.6 KB gzipped, with node ids, section links, and light and dark mode from agent-report's tokens. Add a `diagram` block that renders Mermaid text through Pele in the render stage. The viewer treats the SVG as opaque markup, as it does for diffs. I judged the layouts at 1200px and 375px.

Costs and constraints for the real build:
- Render twice (wide, and `maxWidth: 340`) and swap with a media query, or accept a single layout.
- Use a typed `nodes` list with `{ id, label, path }` so the build can verify each path. Free-form Mermaid cannot be verified.
- Style per-node colour through classes and page CSS, never `classDef` colours.

The riskiest open item is label clipping. Pele sizes boxes from its built-in metrics, not from the reader's font. [M] With the page font stack set to `ui-monospace, Menlo, monospace`, two nodes (`pierre`, `ref`) overflowed their boxes. Serif (Georgia) and Impact did not. The sample used labels up to 22 characters. The stack in `styles.css` puts `--font-ui` on `ui-sans-serif, system-ui`, and Linux and Windows fallbacks were not tested [G]. Pele exposes `fontFamily`, `fontFamilyMono`, `monospace`, and a custom `measurer` option, so a build-time fix probably exists. It was not tried. A second risk is project age, since Pele is five weeks old and moves quickly (1.13.0 already).

## Addendum: the font-measurement fix
Files: `font.mjs` (subsets the fonts), `build-font.mjs` (renders with a measurer and builds `report-font.html`), `check-font.mjs` (compares widths in Chromium), `table.mjs` (builds the width table), `stress.mmd` (7 nodes with long paths, wide and narrow letters, and punctuation). All in `spikes/pele/`.

The cause of the clipping is that the reader's font is unknown at build time. `--font-ui` resolves to a different font on each operating system, so no measurer can match it. The fix is to pin the diagram font and measure that exact font.

[M] **Baseline with Pele's built-in metrics.** Across the architecture and stress diagrams (18 nodes), system-ui and Georgia had no overflow, with the widest label at 92% and 95% of its box. Verdana overflowed 3 of 18 boxes, and its widest label was 105% of its box. [I] DejaVu Sans, a common Linux default, comes from the same Bitstream Vera design and has similar widths to Verdana, so Linux readers would probably see the same overflow. DejaVu itself was not tested.

[M] **The embedded font.** Inter's Latin variable woff2 (48,256 bytes), subset to printable ASCII plus six typographic characters, with the weight axis kept from 400 to 700, is 20,864 bytes. As base64 in the page it is 27,820 bytes raw and about 21 KB gzipped. Base64 of woff2 barely compresses.

[M] **The measurer.** `measurer: { width(text, size, style) }` returns the advance width from the same font, read with fontkit, including kerning. In Chromium, `getComputedTextLength()` of each of 33 label lines differed from the predicted width by at most 0.185 px. No label overflowed. The page made no network requests, had no scripts, and the font showed `loaded`. The font stack was `ARDiagram, "DejaVu Sans", monospace`, so the result doesn't depend on which fallback fonts are installed. Labels that are too long wrap inside the box (screenshot `report-font.png`).

[M] **A width table replaces fontkit at runtime.** fontkit is 5.6 MB on disk and cannot make weight variations from a woff2 file, so it needs a TTF copy of the subset (56,560 bytes). A table of advance widths for 95 characters plus 2,467 non-zero kerning pairs is 52,850 bytes of JSON (8,567 gzipped). It matched fontkit to 0 px on every label and Chromium to 0.185 px. A dev-time script generates the table from the same subset that gets embedded. The published package then ships the woff2 and the table, and no font library.

[M] **Weights and mono are unused by flowcharts.** All 79 measurer calls used style 0 (regular, not mono). `**bold**` in a plain quoted label renders literally. The mono font never loaded, so embed only the sans subset (saves 23,360 bytes). If a later diagram type uses bold or mono, add its widths to the table then.

[M] **Syntax errors carry positions.** A backtick inside a quoted label throws a `PeleError` with `line`, `column`, and a caret snippet, so the build can turn it into a report-line diagnostic.

**Verdict for the fix.** Pin the diagram font to an embedded Inter subset and measure it with a generated width table. The cost is about 21 KB gzipped per report that has a diagram, paid once, not per diagram. The 1.6 KB diagram itself is negligible next to it. Using a system font stack with padding was rejected, since overflow then depends on the reader's operating system.
