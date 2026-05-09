# Ripstop

**Git hook and CI guardrails for AI-assisted software development.**

Ripstop is a TypeScript CLI that runs **policy checks at Git boundaries** (commit, commit message, push, rebase, CI). It targets repos where **Cursor, Claude Code, Codex, Amazon Q**, or humans make changes: the same rules apply no matter who produced the diff.

It does **not** replace sandboxing, server-side branch protection, secret scanning, or code review. It **does** give you a **consistent, repo-local enforcement layer**, optional **agent-readable summaries** (`RIPSTOP.md`), and **forensics** so casual mistakes and “quietly weaken the guardrails” edits are much harder.

Invoke the CLI as **`ripstop`** (for example `npx ripstop` when the package is a devDependency).

---

## Built-in checks (today)

Each check is configured under `checks.<name>` in **`.guardrails.yaml`**, with **`mode: off | warn | enforce`**, **`triggers`**, and check-specific options. Built-in presets (for example **`@jonverrier/ripstop/presets/internal-tooling`**) wire defaults; repos can extend or override.

| Check | What it enforces | Typical triggers |
|--------|------------------|------------------|
| **`pii`** | Common PII patterns in files you commit (with exemptions). | `pre-commit`, `ci` |
| **`path-guard`** | Changes under **protected globs** need an **approval trailer** in the **final commit message** (e.g. `CHANGE-APPROVED: TICKET-123`). | `commit-msg`, `ci` |
| **`test-skip`** | New or disallowed test-skip / disabled-test patterns; optional **ticket** requirement. | `pre-commit`, `ci` |
| **`history-guard`** | **Force-push** and **remote branch delete** on **protected branch** patterns. | **`pre-push` only** (Git supplies ref updates on stdin) |
| **`ripstop-md-fresh`** | Committed **`RIPSTOP.md`** exists and its **embedded config hash** matches the **resolved** `.guardrails.yaml` (including preset merge). | `pre-commit`, `ci` |
| **`reflog-witness`** | Appends **witness JSONL** per run (branch, **`.guardrails.yaml`** hash and optional content on change, **`RIPSTOP.md`** hash, etc.). | `pre-commit`, `pre-push`, `pre-rebase`, `ci` |

Further behaviour is in [**`docs/ripstop-spec.md`**](docs/ripstop-spec.md). Checks **specified but not implemented** yet are listed in [**`docs/ripstop-roadmap-plan.md`**](docs/ripstop-roadmap-plan.md).

Use **`commit-msg`** for **`path-guard`** (and other trailer-based rules): Git has not finalized the message at **`pre-commit`**.

---

## Agent context (**0.1.x** — `RIPSTOP.md`)

From **0.1.x** onward, Ripstop can mirror **resolved** policy into **Layer 1** (agent static context) so agents see active rules before they edit.

- **`ripstop generate-md`** — Writes **`RIPSTOP.md`** from merged config (local YAML + **`extends:`** presets). Commit it and reference it from **`AGENTS.md`** / harness manifests ([**`docs/per-agent-config.md`**](docs/per-agent-config.md)).
- **Per-agent formats** — **`--format claude`**, **`cursor`**, **`codex`**, **`q`** adjust framing; the **config hash** in the file is the same across formats so **`ripstop-md-fresh`** stays consistent.
- **`ripstop-md-fresh`** — Fails when **`RIPSTOP.md`** is missing or stale vs resolved config.
- **Flags** — **`--output`**, **`--check-fresh`**, **`--dry-run`**, **`--config`**.

Design notes: [**`docs/ripstop-markdown-enhancement-spec.md`**](docs/ripstop-markdown-enhancement-spec.md).

```bash
npx ripstop generate-md
git add RIPSTOP.md
```

---

## Self-protection (**0.2.x**)

**0.2.x** closes the gap where an agent could **weaken `.guardrails.yaml` or generated docs** in the same commit as “fixing” a failure.

1. **`path-guard` preset defaults** — Presets add `.guardrails.yaml`, `.guardrails/**`, `RIPSTOP.md`, and `.claude/settings*.json` (including `settings.ripstop.json`) to **`protected_paths`**, with the same approval trailer as your other paths. Dedicated findings call out **guardrails self-protection**.
2. **`RIPSTOP.md`** — Generated copy includes **what you must not modify**; optional Claude output adds harness-oriented **deny** rules.
3. **`ripstop generate-md --format claude`** — Writes **`.claude/settings.ripstop.json`**; merge **`permissions.deny`** into your real **`.claude/settings.json`** per [**`docs/per-agent-config.md`**](docs/per-agent-config.md).
4. **`reflog-witness`** — Witness lines include **`.guardrails.yaml`** and **`RIPSTOP.md`** hashes (and yaml content on change, within limits).
5. **`ripstop recover --config-history`** — Prints witness history (optional **`--since`**, **`--config`**).

This is not tamper-proof against shell access and **`--no-verify`**. Details: [**`docs/ripstop-self-protection-enhancement-spec.md`**](docs/ripstop-self-protection-enhancement-spec.md).

```bash
npx ripstop recover --config-history
npx ripstop recover --config-history --since 2026-01-01T00:00:00.000Z
```

---

## Observability

- **Findings** — human or JSON (configurable).
- **`reporting.audit_log`** — findings / bypasses (default **`.git/ripstop/audit.jsonl`**).
- **`reporting.witness_log`** — witness events (default **`.git/ripstop/witness.jsonl`**), including **`reflog-witness`**.

---

## Documentation

| Document | Role |
|----------|------|
| [**`docs/ripstop-spec.md`**](docs/ripstop-spec.md) | Full product specification. |
| [**`docs/ripstop-consumer-playbook.md`**](docs/ripstop-consumer-playbook.md) | Adoption, hooks, governance, recovery. |
| [**`docs/per-agent-config.md`**](docs/per-agent-config.md) | Per-agent `RIPSTOP.md` wiring; Claude settings merge. |
| [**`docs/ripstop-roadmap-plan.md`**](docs/ripstop-roadmap-plan.md) | Shipped vs planned. |
| [**`docs/ripstop-markdown-enhancement-spec.md`**](docs/ripstop-markdown-enhancement-spec.md) | Design notes for `generate-md` / `ripstop-md-fresh`. |
| [**`docs/ripstop-self-protection-enhancement-spec.md`**](docs/ripstop-self-protection-enhancement-spec.md) | Design notes for self-protection. |

---

## Install

```bash
npm install --save-dev @jonverrier/ripstop
```

Example Husky wiring:

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

The **`internal-tooling`** preset already includes self-protection paths, **`reflog-witness`**, **`ripstop-md-fresh`**, and **`history-guard`**. See **`src/presets/`** for the full merged defaults.

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

**`--trigger`:** `pre-commit`, `commit-msg`, `pre-push`, `pre-rebase`, `pre-action`, `ci`.

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
