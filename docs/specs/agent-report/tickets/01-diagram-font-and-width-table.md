# Generate the diagram font and its width table

Status: ready-for-agent

## Parent

`docs/specs/agent-report.md`, the **Diagrams** decision. The evidence is in the addendum of `docs/spikes/pele.md`.

## What to build

A dev-time script that turns Inter's Latin variable woff2 into the two assets the diagram block needs, and the measurer that reads them. The script subsets the font to printable ASCII plus a few typographic characters, keeps the weight axis from 400 to 700, and writes the subset woff2. It then writes a table of advance widths and non-zero kerning pairs for regular weight, measured from that same subset. Both outputs are committed, so the published package ships no font library. The measurer is a pure function that Pele accepts as its `measurer` option and that returns widths from the table.

This is a prefactor. Nothing in a report changes yet.

## Acceptance criteria

- [ ] Running the script twice produces byte-identical outputs.
- [ ] The subset woff2 is about 21 KB, and the width table is under 10 KB gzipped. The real numbers are recorded in the commit message.
- [ ] The font library and the subsetter are dev dependencies only. `pnpm build` output doesn't import them.
- [ ] The measurer's widths match the spike's numbers for the spike's labels (a one-off check, reported in the reply).
- [ ] Inter's licence (SIL OFL) ships beside the font.

## Blocked by

None, can start immediately.
