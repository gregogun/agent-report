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
  - id: resolve
    label: Resolve
    path: src/resolve
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
