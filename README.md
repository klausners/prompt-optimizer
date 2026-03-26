# prompt-optimizer

Close the eval-to-improvement loop for [promptfoo](https://promptfoo.dev). Evaluate your prompts, identify what's failing, rewrite with any LLM, and re-evaluate — automatically.

## Why this exists

promptfoo tells you which prompts are underperforming. But then what? You read the judge's reasoning, manually rewrite, re-run evals, compare scores, repeat. prompt-optimizer automates that loop.

Unlike [DSPy](https://dspy.ai) or [Promptim](https://blog.langchain.com/promptim/), this tool doesn't require you to adopt a framework, rewrite your prompts as "signatures", or migrate to a new ecosystem. Your prompts stay as plain text files. Your evals stay in promptfoo. You add one YAML config and run a command.

**No lock-in. No migration. Just close the loop.**

## How it works

```
promptfoo eval ──> parse scores ──> below threshold? ──> rewrite with LLM ──> re-eval
                                          │                      │
                                          │                 saves backup
                                          │              validates {{placeholders}}
                                          │
                                    all passing ──> done
                                    stagnant ──> stop + diagnostics
                                    user says no ──> stop
```

1. Runs your promptfoo eval suite
2. Parses scores per prompt, per dimension (your rubrics, your criteria)
3. Identifies prompts below your threshold
4. Asks before rewriting (human-in-the-loop)
5. Backs up the current version, rewrites via any promptfoo-supported provider, validates all `{{placeholders}}` are preserved
6. Re-evaluates and repeats until all prompts pass or progress stagnates

## What makes it different

| | prompt-optimizer | DSPy | Promptim |
|---|---|---|---|
| Prompt format | Plain `.txt` files | DSPy signatures (framework-specific) | LangChain templates |
| Eval system | Your existing promptfoo config | Built-in | LangSmith |
| Rewriter LLM | Any promptfoo provider (OpenAI, Anthropic, Ollama, etc.) | Built-in | Built-in |
| Optimization | Rubric-guided rewriting | Few-shot, fine-tuning, rewriting | Rewriting |
| Human control | Asks before each rewrite, backs up versions | Automatic | Automatic |
| Setup | One YAML config file | Rewrite your prompts as modules | Migrate to LangChain |
| Lock-in | None — remove it and your prompts still work | High | Medium |

## Requirements

- Node.js 20+
- promptfoo in your project (`npm install -D promptfoo`)
- API key for your chosen rewriter provider (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- promptfoo config with `llm-rubric` assertions (see "Writing good rubrics")

## Installation

```bash
npm install prompt-optimizer
```

## Quick start

1. Create `prompt-optimizer.config.yaml` in your project root:

```yaml
promptsDir: prompts
evalConfig: evals/promptfooconfig.yaml
versionsDir: evals/prompt-versions
# envFile: .env.local  # optional — omit if env vars already set

threshold: 4.0
maxIterations: 3
stagnationThreshold: 0.3
rewriterModel: openai:gpt-4o  # any promptfoo provider works

# Map dimension names to keywords in your rubric text
dimensions:
  clarity: CLARITY
  relevance: RELEVANCE
  completeness: COMPLETENESS

# Map promptfoo provider labels to prompt files
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

All paths resolve relative to `process.cwd()`.

## Config reference

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| promptsDir | yes | — | Directory containing prompt `.txt` files with `{{placeholders}}` |
| evalConfig | yes | — | Path to your promptfoo config YAML |
| envFile | no | — | Env file to source and pass to promptfoo as `--env-file` |
| versionsDir | yes | — | Directory for prompt version backups before rewriting |
| threshold | no | 4.0 | Minimum acceptable score (1-5 Likert scale) |
| maxIterations | no | 3 | Max eval-improve cycles before stopping |
| stagnationThreshold | no | 0.3 | Min improvement on any failing dimension to keep going |
| rewriterModel | no | openai:gpt-4o | Any [promptfoo provider](https://www.promptfoo.dev/docs/providers/) for rewrites (e.g., `anthropic:claude-sonnet-4-20250514`, `ollama:llama3`, `openai:gpt-4o`) |
| dimensions | yes | — | `name: KEYWORD` — keyword must appear in your rubric assertion text |
| providerToFile | yes | — | `provider-label: filename` — links providers to prompt files |

## Writing good rubrics

The optimizer is only as good as your rubrics. Vague rubrics produce arbitrary scores — the LLM judge will interpret "good" differently every run.

**Anchor your rubrics** with observable criteria and explicit failure conditions:

```yaml
# Bad — the judge invents its own definition of "clear"
clarity:
  type: llm-rubric
  value: "The output should be clear."

# Good — anchored with what to look for and when it fails
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
- **Define failure explicitly** — "FAILS if..." forces the judge to look for specific problems, not vibes
- **Use context variables** — promptfoo supports `{{role}}`, `{{context}}`, or any test variable in rubrics, anchoring evaluation to each scenario
- **Anchor the scale** — describe what a 1, 3, and 5 look like if you need consistency across runs
- **Test your rubrics first** — run the eval once and read the judge's reasoning. If scores feel arbitrary, your rubric is too vague

**Example with scale anchoring and context variables:**

```yaml
relevance:
  type: llm-rubric
  value: >
    RELEVANCE: The output is specifically relevant to a {{role}} working
    in {{industry}}.
    Score 5: References dynamics, risks, or terminology specific to this
    industry that would not apply elsewhere.
    Score 3: Somewhat relevant but could apply to adjacent industries
    with minor edits.
    Score 1: Generic advice that works for any industry unchanged.
    FAILS if you could swap the industry and nothing would change.
```

## How dimensions work

The optimizer maps scores to dimensions by keyword matching:

1. You define `clarity: CLARITY` in your config
2. You include `CLARITY` in your rubric's assertion text
3. The judge returns a score with `<score>N</score>` in its reasoning
4. The optimizer reads it and maps it to the `clarity` dimension

Rubrics without a matching keyword are ignored by the optimizer.

## Shared prompt files

When multiple providers share a prompt file (configured via `providerToFile`), the optimizer:
- Merges their scores, keeping the worst per dimension
- Tells the rewriter to balance improvements across all providers
- Avoids optimizing for one provider at the expense of another

## Safety

- **Human-in-the-loop**: asks before every rewrite cycle
- **Version backups**: saves the current prompt before overwriting
- **Placeholder validation**: rejects rewrites that drop any `{{placeholder}}`
- **Stagnation detection**: stops automatically when rewrites aren't helping
- **No secrets in the package**: reads API keys from your environment, never stores credentials

## Platform support

macOS, Linux, WSL. Uses `/bin/bash` for env file sourcing. No native Windows support (use WSL or Git Bash).

## License

[MIT](LICENSE)
