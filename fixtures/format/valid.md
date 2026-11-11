---
version: 1
title: Session storage rewrite
---

# Overview

This change moves **sessions** to Redis.

```ts
const x = 1;
```

```diff range=main..HEAD path=src/auth.ts hunks=1-2
@new:42 Check moved up.
@new:57-61 A range. Continues
on the next line with `code`.
@old:12 The removed guard.
@"token.expires" Quoted code, side defaults to new.
@old:"legacyLogin()" Quoted code on the old side.
```

```diff range=main..HEAD path=src/b.ts hunks=3
@new:1 Single hunk, one annotation.
```

Between blocks.

```callout kind=edge-case title="Clock skew"
Tokens can look expired when clocks drift.

- one
- two
```

```decision title="Where to store sessions"
chosen: Redis
why: Keys **expire** natively.
alternatives:
  - option: Postgres
    reason: Needs a cleanup job.
```

```diagram
boxes:
  - id: cli
    label: CLI
    path: src/cli
  - id: format
    label: Format
    path: src/format
arrows:
  - from: cli
    to: format
  - from: format
    to: cli
    kind: loose
```

```review-checklist
- Check the migration is reversible
- Confirm auth rejects expired tokens
  - nested detail
```
