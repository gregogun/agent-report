---
version: 1
title: How agent-report was specified
---

This report is built from this repository's own history. It exercises every block type, so it doubles as the design reference for the viewer.

## Background

The first commit records the spec and the build plan. Prose is plain Markdown, with **bold**, `inline code`, and [links](https://example.com). A report should read like a short essay with code in the margins, not like a wall of tooling output.

```callout kind=concept title="Single file"
A report is one HTML file with no network requests, so it opens from disk.
```

```callout kind=note
Everything below is real. The diffs come from this repository's `git log`.
```

### What changed first

Two edits followed the spike. The spec dropped client rendering, and the plan dropped Vite. Both follow from one measurement: the client component costs about 1.5 MB, and the pre-rendered diff costs about 63 KB.

```callout kind=edge-case title="Browsers"
Declarative shadow DOM needs Chrome 111, Safari 16.4, or Firefox 123. Older browsers show an empty diff.
```

## The spec change

```diff range=7bcd416..HEAD path=docs/specs/agent-report.md
@new:46 Scaffolding stops mentioning Vite. Nothing in the pipeline needs a bundler any more.
@new:53-54 The last two pipeline stages change shape together. **Render** now owns the diff HTML, and **Emit** replaces JSON injection with static React.
@"renderToStaticMarkup" This is the line that moves the viewer from the browser into Node.
@old:91 The old open question, answered by the spike.
```

```callout kind=warning title="Inert diffs"
Expanders for unchanged lines and hover states do nothing, because no diff JavaScript ships.
```

```decision title="Static diffs"
chosen: Pre-render diffs in Node.
why: The client component costs about 1.5 MB.
alternatives:
  - option: Render in the browser
    reason: Too heavy for a single file.
  - option: Hybrid, with a small client script for expanders
    reason: Not measured, and it needs a restricted language set.
```

## The plan change

```diff range=7bcd416..HEAD path=docs/plan.md
@new:14 Scaffold no longer asks for a generator-made viewer. React is only used on the server.
@new:19 Ticket 5 grows to cover **emit**, which is where the viewer lives now.
```

## Review

```review-checklist
- Check the declarative shadow DOM wrapping.
- Check that no request leaves the page.
- Check that every diff block, not only the first, renders with its own styles.
```
