# Build an architecture overview of a real project for review

Status: ready-for-human

## Parent

`docs/specs/agent-report.md`, user stories 19 to 23.

## What to build

An agent writes an architecture overview report of agent-report itself, using only `agent-report reference` to learn the format. The report has a diagram, prose sections that the boxes link to, and callouts. The agent records how many builds it took and the exact error messages from each failed build.

This needs a human because the user judges whether the diagram aids understanding and whether the look is right, and then picks the field spellings the spec left open.

## Acceptance criteria

- [ ] The report builds, and its HTML is handed to the user.
- [ ] The reply lists the number of builds and every error message.
- [ ] The user has decided on the field names and box shapes, and that decision is written into the spec's **Left to the build** list.

## Blocked by

- 03 Fail the build when a diagram box points at a missing path
- 04 Link a diagram box to a section of the report
- 05 Make diagrams readable on a phone
