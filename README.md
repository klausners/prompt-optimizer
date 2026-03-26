# prompt-optimizer

Config-driven CLI that runs [promptfoo](https://promptfoo.dev) evals, identifies low-scoring prompts, rewrites them via Claude API, and re-evaluates — in an automated loop.

## How it works

1. Runs your promptfoo eval suite
2. Parses scores per prompt, per dimension
3. Identifies prompts below your threshold
4. Asks if you want to auto-rewrite them (Claude API)
5. Saves a backup, rewrites, and re-evaluates
6. Stops when all prompts pass or progress stagnates

## Requirements

- Node.js 20+
- `ANTHROPIC_API_KEY` environment variable set
- promptfoo installed in your project (`npm install -D promptfoo`)
- A promptfoo config with `llm-rubric` assertions using `<score>` tags (see "Writing good rubrics" below)

## Installation

```bash
npm install prompt-optimizer
```

## Usage

1. Create `prompt-optimizer.config.yaml` in your project root:

```yaml
promptsDir: prompts
evalConfig: evals/promptfooconfig.yaml
versionsDir: evals/prompt-versions
# envFile: .env.local  # optional — omit if env vars already set

threshold: 4.0
maxIterations: 3
stagnationThreshold: 0.3
rewriterModel: claude-sonnet-4-20250514

# Dimensions: map a name to the keyword that identifies it in your rubric text.
# The optimizer searches each assertion's value for these keywords to classify scores.
dimensions:
  clarity: CLARITY
  relevance: RELEVANCE
  completeness: COMPLETENESS

# Provider-to-file: map each promptfoo provider label to the prompt file it uses.
# When a provider scores below threshold, the optimizer rewrites its prompt file.
providerToFile:
  summarizer: summarizer-system.txt
  classifier: classifier-system.txt
  responder: responder-system.txt
```

2. Run:

```bash
npx prompt-optimizer
```

Or with a custom config path:

```bash
npx prompt-optimizer -c custom.yaml
```

All paths in the config are resolved relative to `process.cwd()`.

## Config Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| promptsDir | yes | — | Directory containing prompt .txt files with `{{placeholders}}` |
| evalConfig | yes | — | Path to your promptfoo config YAML |
| envFile | no | — | Env file to source and pass to promptfoo as `--env-file` |
| versionsDir | yes | — | Directory for prompt version backups before rewriting |
| threshold | no | 4.0 | Minimum acceptable score (1-5 Likert scale) |
| maxIterations | no | 3 | Max eval-improve cycles before stopping |
| stagnationThreshold | no | 0.3 | Min improvement on any failing dimension to keep going |
| rewriterModel | no | claude-sonnet-4-20250514 | Claude model used for prompt rewrites |
| dimensions | yes | — | `name: KEYWORD` map — the keyword must appear in your rubric assertion text |
| providerToFile | yes | — | `provider-label: filename` map — links promptfoo providers to prompt files |

## Writing good rubrics

The optimizer relies on your promptfoo rubrics to judge prompt quality. Poorly written rubrics lead to meaningless scores — the LLM judge will interpret vague criteria differently across runs.

**Anchor your rubrics.** Don't just name the dimension — describe what good looks like and when it fails:

```yaml
# Bad — the judge decides what "clear" means
clarity:
  type: llm-rubric
  value: "The output should be clear."

# Good — anchored with observable criteria and failure conditions
clarity:
  type: llm-rubric
  value: >
    CLARITY: The output uses short sentences, avoids jargon, and can be
    understood by someone with no domain expertise.
    It FAILS if the reader needs to re-read a sentence to understand it,
    or if acronyms are used without definition.
```

**Guidelines:**

- **Include the dimension keyword** (e.g., `CLARITY`) in the rubric text — this is how the optimizer maps scores to dimensions
- **Define failure explicitly** — "FAILS if..." forces the judge to look for specific problems, not just vibes
- **Use context variables** — promptfoo lets you use `{{role}}`, `{{context}}`, or any test variable in rubrics. This anchors evaluation to the specific scenario being tested
- **Be specific about the scale** — if you need consistency across runs, describe what a 3 vs 5 looks like
- **Test your rubrics** — run the eval once and read the judge's reasoning. If the scores feel arbitrary, your rubric is too vague

**Example with context variables and scale anchoring:**

```yaml
relevance:
  type: llm-rubric
  value: >
    RELEVANCE: The output is specifically relevant to a {{role}} working
    in {{industry}}.
    Score 5: References specific dynamics, risks, or terminology of this
    industry that would not apply to other industries.
    Score 3: Somewhat relevant but could apply to adjacent industries
    with minor edits.
    Score 1: Generic advice that works for any industry.
    FAILS if you could swap the industry and the advice would still
    work unchanged.
```

## How dimensions work

The optimizer needs to know which score belongs to which dimension. It does this by matching keywords:

1. You define dimensions in your config: `clarity: CLARITY`
2. You include the keyword `CLARITY` somewhere in your rubric's assertion text
3. When the judge returns a score with `<score>N</score>` in its reasoning, the optimizer reads it and maps it to the `clarity` dimension

If a rubric doesn't contain any configured keyword, its score is ignored by the optimizer.

## Shared prompt files

When multiple providers use the same prompt file (e.g., two providers both use `shared-system.txt`), the optimizer detects this via your `providerToFile` config, merges their scores (keeping the worst per dimension), and tells the rewriter not to optimize for one provider at the expense of the other.

## Platform support

- macOS, Linux, WSL (uses `/bin/bash` and `source` for env files)
- No native Windows support — use WSL or Git Bash
