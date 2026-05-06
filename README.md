# Ripstop

**Git hook and CI guardrails for AI-assisted software development.**

Ripstop is a small TypeScript CLI package that catches high-risk agent and human changes at Git boundaries. It is designed for repositories where tools such as Cursor, Claude Code, Codex, and Amazon Q make code changes.

It does not replace sandboxing, branch protection, secret scanning, or code review. It provides the missing middle layer: repo-local hooks and CI checks that fail consistently no matter which agent produced the change.

## What It Does

- Runs configured checks from Git hooks and CI.
- Loads policy from `.guardrails.yaml`.
- Ships built-in presets and checks.
- Reports findings in human-readable or JSON form.
- Writes audit and witness records for review and recovery.

The first implementation includes the core CLI, config loader, check registry, reporter framework, and initial built-in checks. The full product design is in [`docs/agent-guardrails-spec.md`](docs/agent-guardrails-spec.md). A concise **roadmap** (what is shipped, prioritised next steps, and how history vs. working-tree controls fit) is in [`docs/RIPSTOP-ROADMAP-PLAN.md`](docs/RIPSTOP-ROADMAP-PLAN.md).

## Install

```bash
npm install --save-dev @jonverrier/ripstop
```

Wire hooks with Husky or plain Git hooks:

```bash
npx ripstop check --staged --trigger pre-commit
npx ripstop check --staged --trigger commit-msg --commit-msg-file "$1"
npx ripstop check --trigger pre-push
npx ripstop check --trigger pre-rebase
```

Use `commit-msg` for trailer-based policy. `pre-commit` runs before Git has a commit message, so checks such as approval trailers and bypass reasons validate in `commit-msg`.

## Minimal Config

Create `.guardrails.yaml` at the repository root:

```yaml
repo:
  name: my-service
  domain: tooling
  tier: 2

extends: "@jonverrier/ripstop/presets/internal-tooling"

checks:
  path-guard:
    mode: enforce
    triggers: [commit-msg, ci]
    protected_paths:
      - "infra/**"
      - "migrations/**"
    approval_trailer: "CHANGE-APPROVED"

  test-skip:
    mode: warn
    triggers: [pre-commit, ci]
```

Runtime logs default to `.git/ripstop/` so normal hook runs do not dirty the working tree. The paths can be overridden in config.

## CLI

```bash
ripstop check [--staged | --all | --diff <ref>] --trigger <trigger>
ripstop list
ripstop explain <check> [--resolved]
ripstop version
```

Valid triggers are:

- `pre-commit`
- `commit-msg`
- `pre-push`
- `pre-rebase`
- `pre-action`
- `ci`

## Build

```bash
npm install
npm run build
npm run test:ci
npm pack --dry-run
```

## Binary Distribution

The package is designed to support Bun-compiled standalone binaries in a later release milestone. Binary consumers can use built-in checks and YAML config. npm plugin checks and local TypeScript checks require a Node-compatible runtime.

## License

MIT
