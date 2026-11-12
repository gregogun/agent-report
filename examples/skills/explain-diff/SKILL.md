---
name: explain-diff
description: Explain a code change, diff, branch, or PR as a rich agent-report report. Use when the user asks for an explanation or walkthrough of a diff.
---

# Explain a diff

Write an explanation of the specified change as an agent-report report: one Markdown file that `agent-report build` turns into a single HTML file. The tool owns the look, so write no HTML, CSS, or styling instructions.

## Learn the format

Run `npx agent-report reference` (or `agent-report reference` when it is on your PATH, or `node dist/index.mjs reference` in the agent-report checkout). Read all of it before you write. Do not guess block syntax from memory.

## Write the report

Explore the code around the change first, not only the diff. Then cover these in order, as prose with blocks:

1. **Background.** The existing system the change touches. Open with a short paragraph a newcomer can follow, then the narrow part this change builds on. When the change spans several modules, add a `diagram` block of them, and link each box to the section that covers it.
2. **Intuition.** The essence of the change in a few sentences, with a toy example. Put the idea before the mechanics.
3. **Walkthrough.** Group the changes in the order a reader should understand them, not file order. Show each group with a `diff` block, and annotate the real lines that matter. An annotation says why, not what.
4. **Decisions.** A `decision` block for each real choice, with the alternatives the author rejected or could have taken.
5. **Where to review closely.** A `callout` for edge cases and risks, then a `review-checklist` of concrete checks.

Use the `range` the user gave for every `diff` block. Keep the report as short as the change allows.

## Build and fix

Save the report where you were told, or next to the repo root if you were not told. The file must sit inside the repository, because `diff` blocks run git from its directory.

Run `agent-report build <report.md>`. If it prints errors, fix the report from the diagnostics and build again. Each error names the line and carries a hint. Repeat until the build succeeds, then give the user the path of the HTML file.
