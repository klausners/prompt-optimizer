# prompt-optimizer

Config-driven CLI that runs promptfoo evals, identifies low-scoring prompts, rewrites them via Claude API, and re-evaluates.

## Requirements

- Node.js 20+
- `ANTHROPIC_API_KEY` environment variable set
- promptfoo installed in your project (`npm install -D promptfoo`)

## Installation

```bash
npm install prompt-optimizer
```

## Usage

1. Create `prompt-optimizer.config.yaml` in your project root:

```yaml
promptsDir: src/lib/prompts
evalConfig: evals/promptfooconfig.yaml
versionsDir: evals/prompt-versions
# envFile: .env.local  # optional — omit if env vars already set

threshold: 4.0
maxIterations: 3
stagnationThreshold: 0.3
rewriterModel: claude-sonnet-4-20250514

dimensions:
  depth: PROFUNDIDADE
  specificity: ESPECIFICIDADE
  actionability: ACIONABILIDADE
  format: FORMATO

providerToFile:
  team-generation: team-generation.txt
  leader-planning: leader-planning.txt
  agent-execution: agent-system.txt
  synthesis: synthesis.txt
  clarify-work: clarify-work.txt
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
| promptsDir | yes | — | Directory containing prompt .txt files |
| evalConfig | yes | — | Path to promptfoo config YAML |
| envFile | no | — | Env file to source and pass to promptfoo |
| versionsDir | yes | — | Directory for prompt version backups |
| threshold | no | 4.0 | Score threshold (1-5 scale) |
| maxIterations | no | 3 | Max eval-improve cycles |
| stagnationThreshold | no | 0.3 | Min improvement to continue |
| rewriterModel | no | claude-sonnet-4-20250514 | Claude model for rewrites |
| dimensions | yes | — | name -> keyword mapping |
| providerToFile | yes | — | provider label -> prompt filename |
