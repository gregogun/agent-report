---
version: 1
title: How agent-report was specified
---

This report is built from this repository's own history. It exercises every block type.

## Background

The first commit records the spec and the build plan. Prose is plain Markdown, with **bold**, `inline code`, and [links](https://example.com).

```callout kind=concept title="Single file"
A report is one HTML file with no network requests, so it opens from disk.
```

## The change

```diff range=7bcd416..HEAD path=package.json
@new:2 The package name is set here.
```

```decision title="Static diffs"
chosen: Pre-render diffs in Node.
why: The client component costs about 1.5 MB.
alternatives:
  - option: Render in the browser
    reason: Too heavy for a single file.
```

```review-checklist
- Check the declarative shadow DOM wrapping.
- Check that no request leaves the page.
```
