---
version: 1
title: Resolve fixture
---

A plain diff of the small file.

```diff range=HEAD~1..HEAD path=b.ts
```

Two hunks of the big file, with every anchor form.

```diff range=HEAD~1..HEAD path=a.ts hunks=2-3
@new:21 A line anchor on the new side.
@old:38 A line anchor on the old side.
@new:20-21 A range anchor, attached at the end.
@"twentyOne" A text anchor.
@old:"v20 " A text anchor on the old side.
```

Only the first hunk.

```diff range=HEAD~1..HEAD path=a.ts hunks=1
@new:3 The renamed constant.
@old:3 What it used to be.
```
