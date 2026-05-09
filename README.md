# Ripstop

**Git hook and CI guardrails for AI-assisted software development.**

Ripstop is a TypeScript CLI that runs **policy checks at Git boundaries** (commit, commit message, push, rebase, CI). It is built for repos where **Cursor, Claude Code, Codex, Amazon Q**, or humans make changes: the same rules apply no matter who produced the diff.

It does **not** replace sandboxing, server-side branch protection, secret scanning, or code review. It **does** give you a **consistent, repo-local enforcement layer** plus optional **agent-readable summaries** and **forensics** so casual mistakes and “quietly weaken the guardrails” edits are much harder.

Invoke the CLI as `**ripstop`** (for example `npx ripstop` in devDependencies).

---

## Built-in checks (today)

Each check is configured under `checks.<name>` in `**.guardrails.yaml**`, with `**mode: off | warn | enforce**`, `**triggers**`, and check-specific options. Built-in presets (for example `**@jonverrier/ripstop/presets/internal-tooling**`) wire sensible defaults; repos can extend or override.


| Check                  | What it enforces                                                                                                                                                                          | Typical triggers                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `**pii**`              | Common PII patterns in files you commit (with exemptions).                                                                                                                                | `pre-commit`, `ci`                                      |
| `**path-guard**`       | Changes under **protected globs** require an **approval trailer** in the **final commit message** (e.g. `CHANGE-APPROVED: TICKET-123`).                                                   | `commit-msg`, `ci`                                      |
| `**test-skip`**        | New or disallowed test-skip / disabled-test patterns; optional **ticket** requirement.                                                                                                    | `pre-commit`, `ci`                                      |
| `**history-guard`**    | **Force-push** and **remote branch delete** on **protected branch** patterns.                                                                                                             | `**pre-push` only** (Git supplies ref updates on stdin) |
| `**ripstop-md-fresh`** | Committed `**RIPSTOP.md**` exists and its **embedded config hash** matches the **resolved** `.guardrails.yaml` (including preset merge).                                                  | `pre-commit`, `ci`                                      |
| `**reflog-witness`**   | Appends a **witness JSONL** line per run: branch, `**.guardrails.yaml`** hash (and **content** when the hash changes, within size limits), `**RIPSTOP.md`** hash, etc., for later review. | `pre-commit`, `pre-push`, `pre-rebase`, `ci`            |


Further checks and behaviours are described in `**[docs/ripstop-spec.md](docs/ripstop-spec.md)**`; some are **specified but not implemented yet** (see `**[docs/ripstop-roadmap-plan.md](docs/ripstop-roadmap-plan.md)`**).

Use `**commit-msg**` for `**path-guard**` (and any other trailer-based rules): Git has not finalized the message at `**pre-commit**`, so those checks belong on `**commit-msg**`.

---

## Agent context — the “v1.1” markdown track (shipped)

Ripstop can push the **same resolved policy** you enforce at commit time into **Layer 1** (agent static context), so agents see the active rules **before** they edit.

- `**ripstop generate-md`** — Writes `**RIPSTOP.md**` from the **merged** config (local YAML + `**extends:`** presets). The file is meant to be **committed** and referenced from `**AGENTS.md`** / harness manifests (see `**[docs/per-agent-config.md](docs/per-agent-config.md)**`).
- **Per-agent formats** — `**--format claude`**, `**cursor**`, `**codex**`, `**q**` adjust headings and framing; the **config hash** inside the file is the same across formats so `**ripstop-md-fresh`** stays consistent.
- `**ripstop-md-fresh**` — Treats **stale or missing `RIPSTOP.md`** as a finding relative to the resolved config, so Layer 1 does not silently drift from Layer 2.
- **Flags** — `**--output`**, `**--check-fresh**`, `**--dry-run**`, `**--config**` for non-default paths.

Design notes: `**[docs/ripstop-markdown-enhancement-spec.md](docs/ripstop-markdown-enhancement-spec.md)**`.

```bash
npx ripstop generate-md
git add RIPSTOP.md
```

---

## Self-protection — the “v1.2” track (shipped in 0.2.x)

This closes the gap where an agent could **weaken `.guardrails.yaml` or generated docs** in the same commit as “fixing” a failure.

1. `**path-guard` preset defaults** — Built-in presets add `.guardrails.yaml`, `.guardrails/`**, `RIPSTOP.md`, and `.claude/settings*.json` (including `settings.ripstop.json`) to `**protected_paths**`, with the same **approval trailer** as the rest of your change-control paths. `**path-guard`** also surfaces a **dedicated finding** for these paths (clear copy that this is **guardrails self-protection**, not a generic path rule).
2. `**RIPSTOP.md` content** — Generated markdown includes an explicit **“what you must not modify”** section for guardrails files and agent-facing guidance; optional **Claude** output adds harness-oriented **deny** rules.
3. `**ripstop generate-md --format claude`** — Writes `**.claude/settings.ripstop.json**` with `**permissions.deny**` entries; you **merge** that into your real `**.claude/settings.json`** so Claude Code can **enforce** denies where the harness supports it (see per-agent doc).
4. `**reflog-witness` + config** — Witness records include `**.guardrails.yaml`** and `**RIPSTOP.md**` hashes (and **yaml content** on hash change, within limits) for **audit and reconstruction**.
5. `**ripstop recover --config-history`** — Prints **chronological witness lines** so you can inspect **how config evolved** (optional `**--since`**, `**--config**`).

Honest limit: this raises the cost of **casual** and **lazy** bypass; it does **not** make the repo tamper-proof against someone with **shell access** and `**--no-verify`**. Details: `**[docs/ripstop-self-protection-enhancement-spec.md](docs/ripstop-self-protection-enhancement-spec.md)**`.

```bash
npx ripstop recover --config-history
npx ripstop recover --config-history --since 2026-01-01T00:00:00.000Z
```

---

## Observability

- **Findings** can be reported as **human** or **JSON** (see config).
- `**reporting.audit_log`** — JSONL of **check findings** (default `**.git/ripstop/audit.jsonl`**).
- `**reporting.witness_log**` — JSONL of **witness / recovery-oriented** events (default `**.git/ripstop/witness.jsonl`**), including `**reflog-witness**` appends.

Defaults keep routine hook noise **out of the working tree**; override paths in `**.guardrails.yaml`** if needed.

---

## Documentation


| Document                                                                                                   | Role                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `**[docs/ripstop-spec.md](docs/ripstop-spec.md)**`                                                         | Full product specification (checks, triggers, limits).                                  |
| `**[docs/ripstop-consumer-playbook.md](docs/ripstop-consumer-playbook.md)**`                               | Adoption, hooks, governance, recovery.                                                  |
| `**[docs/per-agent-config.md](docs/per-agent-config.md)**`                                                 | One-line inclusion of `RIPSTOP.md` per agent; Claude `**settings.ripstop.json**` merge. |
| `**[docs/ripstop-roadmap-plan.md](docs/ripstop-roadmap-plan.md)**`                                         | Shipped vs planned backlog.                                                             |
| `**[docs/ripstop-markdown-enhancement-spec.md](docs/ripstop-markdown-enhancement-spec.md)**`               | Design rationale for `**generate-md**` / `**ripstop-md-fresh**`.                        |
| `**[docs/ripstop-self-protection-enhancement-spec.md](docs/ripstop-self-protection-enhancement-spec.md)**` | Design rationale for self-protection and forensics.                                     |


---

## Install

```bash
npm install --save-dev @jonverrier/ripstop
```

Example **Husky** wiring (each check runs only on triggers it supports):

```bash
npx ripstop check --staged --trigger pre-commit
npx ripstop check --staged --trigger commit-msg --commit-msg-file "$1"
npx ripstop check --trigger pre-push
npx ripstop check --trigger pre-rebase
```

---

## Minimal `.guardrails.yaml`

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

The `**internal-tooling**` preset already merges **self-protection paths**, `**reflog-witness`**, `**ripstop-md-fresh**`, and `**history-guard**`; the snippet above only **overrides** pieces you care to show. For a full matrix, start from the preset YAML under `**src/presets/`** in this repo.

---

## CLI

```text
ripstop check [--staged | --all | --diff <ref>] --trigger <trigger> [options]
ripstop generate-md [options]
ripstop recover --config-history [--since <iso>] [--config <path>]
ripstop list
ripstop explain <check> [--resolved]
ripstop version
```

`**--trigger**` values: `pre-commit`, `commit-msg`, `pre-push`, `pre-rebase`, `pre-action`, `ci`.

---

## Build

```bash
npm install
npm run build
npm run test:ci
npm pack --dry-run
```

## Binary distribution

The package is designed to support **Bun-compiled standalone binaries** in a later milestone. Binary consumers can use **built-in checks** and **YAML** config. npm plugin checks and repo-local TypeScript checks expect a **Node-compatible** runtime.

## License

MIT