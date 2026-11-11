---
version: 1
title: How agent-report turns Markdown into a report
---

`agent-report build` reads one Markdown file and writes one HTML file. Each stage owns one kind of knowledge, and the arrows below show who calls whom.

```diagram
boxes:
  - id: cli
    label: CLI
    path: src/cli
  - id: format
    label: Format
    path: src/format
    section: Format owns the grammar
  - id: resolve
    label: Resolve
    path: src/resolve
    section: Resolve checks the repo
  - id: render
    label: Render
    path: src/render
  - id: emit
    label: Emit
    path: src/emit
arrows:
  - from: cli
    to: format
  - from: cli
    to: resolve
  - from: cli
    to: render
  - from: cli
    to: emit
  - from: render
    to: emit
    kind: loose
```

Solid arrows are direct calls. The dashed arrow is a looser dependency, since render only shares markdown helpers with emit.

## Format owns the grammar

Format parses the Markdown and the block bodies, and rejects anything the grammar does not allow. It does no I/O.

## Resolve checks the repo

Resolve asks git whether each diff range and each box path exists, so a report cannot describe code that is not there.
