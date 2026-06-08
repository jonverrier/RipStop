# Ripstop Agent Instructions

Instructions for AI assistants working on the `@jonverrier/ripstop` package. This is a **standalone** repository — not part of a monorepo workspace.

## Project Overview

Ripstop is a TypeScript CLI that enforces Git hook and CI guardrails for repositories where AI coding agents (or humans) make changes. Product behaviour is defined in `docs/ripstop-spec.md`; adoption and operations are in `docs/ripstop-consumer-playbook.md`, with focused enhancement specs alongside them.

The package was built for the Strong AI platform and installs into any repo via `@jonverrier/ripstop` — consumers wire Husky or native Git hooks locally.

Ripstop is a tripwire at Git boundaries. It does not claim to sandbox agents or prevent direct filesystem destruction outside Git.

## Package Structure

```text
src/
  cli.ts              CLI entrypoint (bin: ripstop)
  index.ts            Public exports
  checks/             Built-in checks and check interface
  config/             YAML loading, preset merge, schema validation
  git/                Git command adapters
  logs/               Audit and witness writers
  reporters/          Human and JSON output
  generators/         RIPSTOP.md generation
  presets/            Built-in YAML presets copied into dist
test/                 Jest unit and integration tests
docs/                 Product specs and consumer playbook
dist/                 Published compiled output
```

## Build, Test, And Publish

```bash
npm install
npm run build          # tsc -b && copy presets to dist
npm run test:ci        # Jest CI subset
npm pack --dry-run
```

**Publish** (GitHub Packages): commit on `develop`, merge to `main`, `npm publish` with `NODE_AUTH_TOKEN`.

## Coding Standards

- TypeScript strict mode, ES2022, Node 22, CommonJS.
- Use named exports.
- Keep CLI argument parsing local and explicit; do not add commander or yargs unless the package grows beyond the current command surface.
- Use `process.stdout.write(...)` and `process.stderr.write(...)` in CLI paths.
- Use `@jonverrier/assistant-common` error classes rather than raw built-in errors.
- Avoid dependencies with native bindings. The package must remain suitable for Bun-compiled binary distribution.
- Treat audit, witness, and snapshot output as runtime data. Default it outside the normal working tree.

## Testing Notes

- Jest + `expect`; `describe`/`it` are globals.
- Run `npm run test:ci` directly — do not pipe live test output through `tail`/`grep`.
- Cover config merge, check triggers, reporters, and CLI parsing in unit tests; use integration tests for end-to-end hook scenarios where appropriate.

## Agent Context Files

- **`RIPSTOP.md`** — Generated policy summary for agents; keep fresh with `ripstop generate-md` and the **`ripstop-md-fresh`** check.
- Consumer repos reference `RIPSTOP.md` from their own **`AGENTS.md`**; this file documents the Ripstop package itself.

## Git Safety

- Never run destructive Git commands unless the user explicitly asks.
- Do not delete untracked files without approval.
- Before committing, inspect `git status --short --branch` from the Ripstop repository root.
- No AI attribution in commit messages.

## Related Packages

- **AssistantCommon** (`@jonverrier/assistant-common`) — shared error types.
- **AutoDoc** (`@jonverrier/auto-doc`) — generates architecture docs for this repo (`README.StrongAI.*.md` under `src/`).
