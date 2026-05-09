# Per-agent inclusion of `RIPSTOP.md`

**Companion:** `ripstop-markdown-enhancement-spec.md`,
`ripstop-self-protection-enhancement-spec.md`,
`ripstop-consumer-playbook.md`

This note lists **one-line patterns** to pull the generated `RIPSTOP.md`
into each agent’s static context. Agents do not fetch URLs at session
start; the file must exist in the repo (regenerate with
`ripstop generate-md` after `.guardrails.yaml` changes).

Format variants (`--format claude|cursor|codex|q`) adjust framing; the
embedded **config hash** is identical across variants so
`ripstop-md-fresh` stays consistent.

---

## Claude Code

In `CLAUDE.md` or `AGENTS.md`:

```markdown
@RIPSTOP.md
```

Optional: also reference the consumer playbook:

```markdown
@docs/ripstop-consumer-playbook.md
```

(`--format claude` adds a leading block that points at the playbook.)

### Claude Code — harness deny list (optional)

After `ripstop generate-md --format claude`, Ripstop writes
**`.claude/settings.ripstop.json`** with `permissions.deny` entries for
guardrails files. **Merge** that fragment into your real
`.claude/settings.json` (shallow merge: concatenate and deduplicate
`deny` arrays; do not overwrite unrelated settings). Until merged, the
file has no effect.

---

## Cursor

In `.cursorrules` (or `.cursor/rules` entry), use plain paths — Cursor
does not resolve `@import` the same way as bundlers; keep a short pointer:

```markdown
# Repo guardrails — read RIPSTOP.md before structural edits
```

Then ensure `RIPSTOP.md` is in the workspace root, or paste a summary.
For multi-root workspaces, generate with `--output` per package if
needed.

(`--format cursor` rewrites section headings for imperative emphasis.)

---

## GitHub Copilot / Codex (CLI or editor integration)

In harness `context_files` or equivalent YAML:

```yaml
context_files:
  - RIPSTOP.md
```

(`--format codex` prepends a short explicit example line.)

---

## Amazon Q

In the rules or context manifest your team uses:

```yaml
include:
  - RIPSTOP.md
```

(`--format q` prepends a short directive paragraph.)

---

## Verification at implementation time

Agent products change their config surface frequently. When wiring a
new repo, confirm the exact key names (`context_files`, `include`, etc.)
against the vendor’s current documentation; the **principle** is always
the same: **static local file**, committed, regenerated from
`.guardrails.yaml`.

---

## Forensics — `ripstop recover`

To print chronological `reflog-witness` snapshots (including captured
`.guardrails.yaml` hashes and optional content deltas) from the witness
log:

```bash
npx ripstop recover --config-history
npx ripstop recover --config-history --since 2026-01-01T00:00:00.000Z
```
