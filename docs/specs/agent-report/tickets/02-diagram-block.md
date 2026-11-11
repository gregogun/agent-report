# Draw an architecture diagram from a diagram block

Status: ready-for-agent

## Parent

`docs/specs/agent-report.md`, user stories 19 and 22, and the **Diagrams** decision.

## What to build

An agent writes a fenced `diagram` block whose YAML body lists boxes (id, label, path) and arrows (from, to, and whether the dependency is direct or loose). `agent-report build` draws it in the report as an inline SVG through Pele. Labels use the embedded diagram font and the measurer from ticket 01, so no label overflows its box. The SVG follows the report's colour tokens in light and dark mode. The font is inlined only when the report has at least one diagram.

Validation happens in the format stage, with no I/O. A duplicate box id, an arrow to an unknown box, and a missing or wrongly typed field each fail the build at the report line of the offending entry, with a hint that says how to fix it. `agent-report reference` lists the block with an example, because it comes from the zod schema.

Paths are carried through but not checked yet (ticket 03). Field names follow the spec. The spec leaves the exact spelling open, so pick the spelling that matches the `decision` block's style.

## Acceptance criteria

- [ ] A fixture report with a diagram of agent-report's own architecture builds, and the HTML shows every box and arrow in light and dark mode.
- [ ] `agent-report reference` shows the `diagram` block, and its example builds.
- [ ] Error-message tests cover a duplicate box id and an arrow to an unknown box, asserting the message and the report line.
- [ ] The end-to-end test opens a report with a diagram, asserts that every box draws, that no label is wider than its box, and that the page makes no network requests.
- [ ] A report without a diagram has the same size as before this ticket.

## Blocked by

- 01 Generate the diagram font and its width table
