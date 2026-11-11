#!/usr/bin/env bash
# Stand-in for `claude -p` in the head-to-head test. Reads no prompt and calls no model.
cat > /dev/null
if [ "$H2H_ARM" = explain-diff-html ]; then
  echo '<html><body>fake explanation</body></html>' > "$H2H_ARTIFACT"
else
  report="$H2H_WORKDIR/report.md"
  printf -- '---\nversion: 1\n---\n\nBad draft, no title.\n' > "$report"
  agent-report build "$report" >&2 || true
  cat > "$report" <<MD
---
version: 1
title: Fake report
---

Fixed after reading the error.

\`\`\`diff range=$H2H_RANGE path=a.ts
@new:6 The changed line.
\`\`\`
MD
  agent-report build "$report" >&2
fi
echo '{"type":"result","duration_ms":1500,"total_cost_usd":0.0123,"usage":{"input_tokens":4,"cache_creation_input_tokens":2,"cache_read_input_tokens":4,"output_tokens":20}}'
