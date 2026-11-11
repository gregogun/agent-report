# Run the head-to-head

This is step 3 of the build order in `docs/specs/agent-report.md`. It generates two explanations of the same diff with the same agent and model: one from the [explain-diff gist](https://gist.githubusercontent.com/geoffreylitt/a29df1b5f9865506e8952488eac3d524/raw/126e7fe9eecaafadfe1ac8bb183d135812b608f2/explain-diff-html.md) (HTML), one from `examples/skills/explain-diff` (agent-report). It also records how often the agent's first report fails validation.

## Run it

1. Build the CLI: `pnpm build`. The script runs `node dist/index.mjs` through a shim.
2. Copy `scripts/head-to-head.cases.example` to a cases file. Each line is `<repo path> <range>`, with no spaces in either field. Pick five real diffs of different sizes and kinds.
3. Check the commands: `scripts/head-to-head --dry-run my-cases.txt`.
4. Run it: `scripts/head-to-head --model sonnet my-cases.txt`. This makes two `claude -p` calls per case, so it spends model credit. Pass `--out DIR` to choose the run directory. The default is `head-to-head-runs/<timestamp>/`.

The agent-report arm writes its report to a temporary directory inside the target repo, because `diff` blocks run git from the report's directory. The script copies the report out and deletes the directory. Set `AGENT_CMD` to run something other than `claude`.

## What you get

Per case, in `<run>/<case>/explain-diff-html/` and `<run>/<case>/agent-report/`: the artifact (`explanation.html`, `report.md` and `report.html`), `prompt.txt`, `agent.json` (the `claude -p` result), and for agent-report `build.log` and `call-N.out`, the output of each CLI call. `build.log` lists each `agent-report` call as `attempt, subcommand, exit code`.

`results.tsv` has one row per case and arm:

| column | meaning |
| --- | --- |
| `first_draft_valid` | `y` when the first `build` exited 0. `-` for the HTML arm |
| `retries` | builds after the first one |
| `final_ok` | `y` when the last build succeeded and produced HTML (HTML arm: the file exists) |
| `build_attempts` | total `build` calls |
| `duration_s`, `cost_usd`, `tokens_in+out` | from the `claude -p` JSON, `?` when absent |

## Judge the pairs

Open each pair side by side. Read the `call-N.out` files of any case with retries. A fix from the error alone is a retry whose next build succeeds without the agent re-reading the reference.

For each pair, ask:

- Which one would you rather read to review the diff? Look at how the annotations sit on the real lines, the order of the walkthrough, and whether the "where to review closely" part names real risks.
- Does explain-diff's free-form diagrams or quiz carry something the agent-report version lacks?
- Did the first draft fail, and was the diagnostic enough to fix it?

Keep one count across the five: pairs where agent-report was better, and the mean retries per case.

## Stop rule

From the spec. Stop if explain-diff is still the better choice for most diffs. If the comparison keeps missing its free-form diagrams, add the HTML escape hatch earlier. If agents need more than one retry on average, simplify the syntax instead of lengthening the format reference.

## Caveats

Five cases, one model, one run each is a small, noisy sample. Rerun a surprising case before you act on it. The two arms differ in prompt length and in sections (the gist asks for a quiz, the skill does not), so cost and duration compare only roughly.
