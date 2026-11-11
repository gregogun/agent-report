# Link a diagram box to a section of the report

Status: ready-for-agent

## Parent

`docs/specs/agent-report.md`, user story 21, and the **Diagrams** decision.

## What to build

A box may name a heading in the same report. Clicking the box in the built page jumps to that heading, with no script. The build fails at the box's report line when the named heading doesn't exist. The check must use the same heading ids that the page renders, so compute them in one place rather than twice.

## Acceptance criteria

- [ ] In the built fixture, clicking a linked box moves to its heading. The end-to-end test asserts the new location hash.
- [ ] An error-message test covers a link to a missing heading, asserting the message and the report line.
- [ ] Linked boxes look clickable on hover and keyboard focus, in light and dark mode.

## Blocked by

- 02 Draw an architecture diagram from a diagram block
