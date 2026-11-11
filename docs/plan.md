# Build plan

This plan turns `docs/specs/agent-report.md` into tickets. Each ticket goes to one subagent, and the chief of staff reviews it before the next ticket starts. The decision trail is `.audit/build.tsv`.

## Done for this run

`agent-report build <report.md>` turns a fixture report into one HTML file that renders prose, an annotated `diff`, `callout`, `decision`, and `review-checklist`, with no network requests. The three test seams in the spec pass. The head-to-head against explain-diff and the demo reports need the user's judgment, so this run prepares them and hands them back.

## Tickets

Riskiest unknown first, then scaffold, then features.

1. **Spike: `@pierre/diffs` in Node.** Find out whether it renders diff HTML in Node without a browser, how annotations attach, and how large a single-file report gets. Throwaway code. The answer decides the render stage.
2. **Scaffold.** The package, TypeScript, React for server rendering, vitest, the CLI build, and a watch script that rebuilds a fixture report on save. No Vite, since reports are rendered in Node.
3. **Format.** The zod block schemas, the remark parse, and validation into the typed block tree, with source positions on every node. Error-message tests.
4. **Resolve.** Fetch patches with `git`, slice hunks, and anchor annotations by line or by quoted code. Pipeline golden tests against a throwaway git repo.
5. **Render, emit, and build.** Pre-render diffs, render the viewer components to static HTML in Node, and add the `build` command. The end-to-end test in headless Chromium.
6. **Viewer design.** Typography, layout, dark mode, phone width, and the annotated diff view.
7. **Format reference command.** Print the block catalog from the zod schemas.
8. **Hand back.** An example skill for explaining a diff, and a script that generates reports for real diffs so the user can run the head-to-head.
