# Ripstop Agent Instructions

## Project Overview

Ripstop is a TypeScript CLI package that enforces Git hook and CI guardrails for repositories where AI coding agents make changes. Product behaviour is defined in `docs/ripstop-spec.md`; adoption and operations are in `docs/ripstop-consumer-playbook.md`, with focused enhancement specs alongside them.

The package is a tripwire at Git boundaries. It does not claim to sandbox agents or prevent direct filesystem destruction outside Git.

## Build And Test

```bash
npm install
npm run build
npm run test:ci
npm pack --dry-run
```

## Coding Standards

- TypeScript strict mode, ES2022, Node 22.
- Use named exports.
- Keep CLI argument parsing local and explicit; do not add commander or yargs unless the package grows beyond the current command surface.
- Use `process.stdout.write(...)` and `process.stderr.write(...)` in CLI paths.
- Use `@jonverrier/assistant-common` error classes rather than raw built-in errors.
- Avoid dependencies with native bindings. The package must remain suitable for Bun-compiled binary distribution.
- Treat audit, witness, and snapshot output as runtime data. Default it outside the normal working tree.

## Package Structure

```text
src/
  cli.ts              CLI entrypoint
  index.ts            public exports
  checks/             built-in checks and check interface
  config/             YAML loading, preset merge, schema validation
  git/                git command adapters
  logs/               audit and witness writers
  reporters/          human and JSON output
  presets/            built-in YAML presets copied into dist
test/                 Mocha tests
docs/                 product specs and consumer playbook
```

## Git Safety

- Never run destructive Git commands unless the user explicitly asks.
- Do not delete untracked files.
- Before committing, inspect `git status --short --branch` from the `Ripstop` repository.
- Do not add AI attribution footers to commits.

