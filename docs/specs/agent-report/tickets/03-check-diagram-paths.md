# Fail the build when a diagram box points at a missing path

Status: ready-for-agent

## Parent

`docs/specs/agent-report.md`, user story 20, and the **Diagrams** decision.

## What to build

The resolve stage checks each box's path against the repo. By default it checks the working tree. When the block names a git ref, it checks that commit. A file or a directory is valid. A path that doesn't exist fails the build at the report line of that box, with a hint naming the closest existing path if there is an obvious one. The rendered box shows its path, so the reader can see which code the box stands for.

## Acceptance criteria

- [ ] A pipeline golden test against the throwaway git repo resolves a diagram with file and directory paths, at the working tree and at a ref.
- [ ] An error-message test covers an unknown path, asserting the message and the report line.
- [ ] Building the ticket 02 fixture still succeeds, because every path in it is real.

## Blocked by

- 02 Draw an architecture diagram from a diagram block
