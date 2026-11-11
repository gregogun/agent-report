# Make diagrams readable on a phone

Status: ready-for-agent

## Parent

`docs/specs/agent-report.md`, user story 23, and the **Diagrams** decision.

## What to build

Each diagram is rendered twice, once at full width and once narrow, and the page shows one or the other with a media query. Pele fixes its layout at build time, which is why it takes two renders. Choose the breakpoint and the narrow width by building the fixture and looking at it at 375px and at the breakpoint.

## Acceptance criteria

- [ ] At 375px the narrow diagram shows, every label fits its box, and the page doesn't scroll sideways. The end-to-end test asserts all three.
- [ ] At 1200px the wide diagram shows.
- [ ] The extra size per diagram is recorded in the reply.

## Blocked by

- 02 Draw an architecture diagram from a diagram block
