---
version: 1
title: Registry entries carry their own reference text
---

The format reference is generated from the block registry. To make that work, each registry entry gained a `body` description and an optional `bodySchema`, and anchor syntax moved into one table.

```callout kind=concept title="One source of truth"
Prop names, types and descriptions come from zod. The only prose lives beside the parser that enforces it.
```

```diff range=45d620b..d27adc2 path=src/format/blocks.ts hunks=1-2
@new:22 `bodySchema` lets the generator walk a YAML body the same way it walks props.
@new:42-48 The anchor forms are now data. The error hint and the reference both read this table.
@old:20 The old one-line string could not be rendered as a table.
@"export const ANCHORS" The exported table.
```

```decision title="How to document anchors"
chosen: A table of form and meaning in blocks.ts.
why: It sits next to the parser, so a grammar change is one edit in one file.
alternatives:
  - option: Prose written in the reference generator
    reason: It would drift from the parser.
```

```review-checklist
- Confirm every example in the reference passes `parseReport`
- Check the hint text in diagnostics did not change
```
