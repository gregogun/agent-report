# agent-report

Status: ready-for-agent

## Problem

Coding agents write reports about code changes, but the reader pays for how they are presented. A report in the terminal is a wall of text. Skills like Geoffrey Litt's explain-diff do better: the agent writes a self-contained HTML page with background, intuition, a code walkthrough, and a quiz. But that agent also rebuilds a design system from scratch on every run. Each report looks different, a share of its tokens goes to CSS, and its quality depends on the model's taste that day. The skill even has to remind the agent to check `white-space: pre` on every code block. Worse, the agent retypes the code it explains, so a report can quote code that is slightly wrong, and the reader has no way to tell.

The result is that reading a report about your own code is more work than it should be, and rarely a pleasure.

## Solution

agent-report is an open-source CLI and viewer. The agent writes only content, as Markdown with a small set of typed blocks. The tool owns how the report looks.

The agent points at code instead of copying it. A `diff` block names a git range and a path, and the CLI pulls the real patch from git at build time. The agent writes the explanation around it and can attach annotations to specific lines. Because the build has the real patch, it checks every annotation against it.

`agent-report build` turns the Markdown into one self-contained HTML file. The file works offline, opens from disk, and can be attached to a PR or a chat message. When the Markdown is wrong, the build fails with an error that names the line in the report and says what to fix, so the agent can repair it without help.

Every report uses the same layout, so a reader learns it once. The design work goes into typography and into the diff view, where this tool does clearly better than a hand-written page.

## User stories

1. As an agent, I want to write a report as Markdown with typed fenced blocks, so that I write in the format I produce most reliably.
2. As an agent, I want to reference a diff by git range and file path, so that I never retype code and the report always shows the real change.
3. As an agent, I want to limit a diff block to the hunks that matter, so that the reader sees only the relevant part of a large file.
4. As an agent, I want to attach an annotation to a line or line range of a diff, so that my explanation sits next to the code it explains.
5. As an agent, I want to anchor an annotation by matching code text instead of a line number, so that a miscounted line does not misplace my note.
6. As an agent, I want the build to fail with the report line number and a plain fix when an annotation points at a line that is not in the patch, so that I can correct it in one try.
7. As an agent, I want the build to fail with the report line number when a block has a missing or invalid property, so that I can correct it in one try.
8. As an agent, I want the build to fail with the report line number when a git range or path does not resolve, so that I find out before the reader does.
9. As an agent, I want to run one command that prints the full format reference for the installed version, so that I learn the blocks and their properties without guessing.
10. As an agent, I want to declare the format version in each report, so that a future format change does not silently break an old report.
11. As an agent, I want a `callout` block for key concepts, definitions, and edge cases, so that important points stand out from the prose.
12. As an agent, I want a `decision` block that records what was chosen, the alternatives, and why, so that the reader sees the reasoning behind the change.
13. As an agent, I want a `review-checklist` block that lists where to look closely, so that the reader spends attention on the risky parts.
14. As a developer, I want the report to be one HTML file that makes no network requests, so that I can open it from disk and share it anywhere.
15. As a developer, I want every report to share one layout and one visual design, so that I know where to find the summary, the risks, and the code.
16. As a developer, I want diffs rendered with syntax highlighting and annotations shown beside the changed lines, so that I understand a change without switching to my editor.
17. As a developer, I want the report to work on a phone and in dark mode, so that I can read it away from my desk.
18. As a developer, I want the report Markdown to stay readable without the tool, so that it still makes sense in a terminal or on GitHub.

## Implementation decisions

**Distribution.** One npm package, run through `npx`. Node 20 or later. No Bun-only APIs. No monorepo until a second consumer of the parser exists.

**Scaffolding.** Create projects and config with generator and install commands, not by hand: `pnpm init`, `pnpm add`, and `tsc --init`. Hand-write only what no generator produces.

**Pipeline.** A build runs five stages, and each stage is a plain function from one data shape to the next:

1. Parse. Turn the Markdown into a syntax tree with remark.
2. Validate. Check each block's properties against its zod schema and produce the typed block tree.
3. Resolve. Run `git` to fetch the patches and file slices that blocks reference, and anchor annotations to real lines.
4. Render. Pre-render each diff with `@pierre/diffs/ssr`, one call per file, with annotation HTML as slot children of the diff.
5. Emit. Render the viewer's React components to static HTML in Node, inline the CSS, and save one HTML file.

Parse and validate do no I/O. All I/O lives in resolve and in the CLI.

**The block tree is the contract.** The zod schemas are the one source of truth for the block types. The viewer's TypeScript types, the format reference that the CLI prints, and the validation error messages all come from them.

**Source positions survive every stage.** Each node keeps its line and column from remark through resolve and render. Any failure, including a git failure, reports the line in the report file.

**Authoring syntax.** Leaf components are fenced code blocks. The fence language names the block type, the info string carries its properties, and the block body is parsed per type. A `diff` block body holds annotations, one per line, each anchored to a side, a line or a line range, or quoted code text. Container components that wrap Markdown, such as a callout with lists inside, use `remark-directive` syntax when they are added. Plain Markdown between blocks is prose.

**First block set.** Prose, `diff` with annotations, `callout`, `decision`, and `review-checklist`. Add a block only when real reports keep asking for it.

**Diffs come from git.** The CLI shells out to the `git` binary instead of using a JavaScript git library, so it respects the user's git config. `git diff` output is the input that `@pierre/diffs` takes.

**Viewer.** React components that the build renders to static HTML in Node with `renderToStaticMarkup`. Reports ship no React and no diff JavaScript. A few lines of plain JavaScript run the table of contents, and `<details>` handles collapsing. The viewer receives only the resolved tree and knows nothing about git or the file system. Design work runs the build on fixture reports in watch mode, so the project needs no Vite. This replaced client rendering after the spike in `docs/spikes/pierre-diffs.md`. `@pierre/diffs` emits declarative shadow DOM, which browsers apply only in the initial HTML, and its client component costs about 1.5 MB against about 63 KB pre-rendered. The cost is that unchanged-line expanders and hover in diffs are inert.

**Styling.** Hand-written CSS with design tokens as CSS variables, not Tailwind. `@pierre/diffs` and, later, Pele theme through CSS variables, so one set of tokens styles every surface. Inline at most one subsetted variable font as woff2, to keep reports small.

**CLI commands.** `build` turns a report into HTML. A command that prints the format reference ships with it. `serve` with live reload comes after the validation phase.

**Format version.** Each report declares `version: 1`. The build rejects versions it does not know.

**No raw HTML.** Version 1 has no escape hatch for raw HTML. Add a sandboxed one only if real reports keep needing free-form diagrams.

**Skills are examples.** The repo may ship optional example skills, such as one for explaining a diff, but they are not part of the product. The format reference command is how any agent or skill learns the format.

**Build order and validation.** Build in this order, and stop at each check:

1. A half-day spike. Confirm whether `@pierre/diffs` can pre-render in Node, and measure the size of a single-file report. The answer decides how the render stage works.
2. The thinnest slice that can beat explain-diff: prose, an annotated `diff`, `callout`, `review-checklist`, `build`, and a viewer with finished typography. Put the design effort into the diff block.
3. A head-to-head on five real diffs. Generate an explain-diff report and an agent-report report from the same agent and the same diff. Record how often the agent's first draft fails validation, and whether the agent fixes it from the error alone.
4. Demo reports for two or three well-known open-source PRs, shared next to the explain-diff versions.

Stop if, after step 3, explain-diff is still the better choice for most diffs. If its free-form diagrams are what the comparison keeps missing, add the HTML escape hatch earlier. If agents need more than one retry on average, simplify the syntax instead of lengthening the format reference.

## Left to the build

- Whether one copy of the `@pierre/diffs` CSS and icon sprite can serve every diff block. Each block carries about 48 KB of fixed overhead otherwise.
- The exact text of the annotation anchor syntax inside a `diff` block body. The head-to-head retry count decides between candidate spellings.
- The name of the command that prints the format reference.

## Testing

Three seams cover the critical paths. Everything else, including the viewer's look and report quality, is verified by running it and reading the output.

1. **Pipeline golden tests.** A fixture Markdown report goes in, and a snapshot of the resolved block tree comes out. Each test runs against a real throwaway git repository created in test setup. Git is a local stand-in, so no port or mock is needed. These tests catch a wrong patch, misplaced annotations, and schema drift. They miss rendering.
2. **Error-message tests.** One fixture per validation error. Each test asserts the message text and the report line number. These tests protect the loop where the agent fixes its own report. They miss whether agents understand the messages, which the head-to-head measures.
3. **One end-to-end CLI test.** Build a fixture report with the real CLI, open the HTML file in headless Chromium, and assert that the diff and its annotations render and that the page makes no network requests. This test catches broken template injection and broken inlining. It misses visual quality.

The project has no existing tests, so there is no prior art.

## Out of scope

- `serve` with live reload, until the validation phase ends.
- Pele diagrams, quizzes, and directive-based containers, until the first block set proves itself.
- Plugins, a theming API, and config files.
- A public library API for the parser.
- A raw HTML escape hatch in version 1.
- First-class skills. Example skills are optional.
- Report types other than diff explanations, until diff explanations work well.
- A GitHub repository and CI, until the user sets them up.
