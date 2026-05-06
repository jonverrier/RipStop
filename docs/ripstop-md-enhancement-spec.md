# Ripstop Enhancement Spec — `RIPSTOP.md` Generation

**Status:** Implemented in package (CLI + `ripstop-md-fresh` + docs); keep this spec as design rationale.
**Type:** Enhancement spec, scoped for inclusion in Ripstop v1.1 or as a
v1.0 stretch
**Companion to:** `agent-guardrails-spec.md`,
`agent-guardrails-consumer-playbook.md`
**Audience:** The engineers extending Ripstop to populate agent-config
files from the resolved guardrails configuration.

---

## 1. Summary

Ripstop currently intervenes *after* an agent does something the
guardrails disallow — at commit, push, or rebase time. This enhancement
extends Ripstop's reach to *before* the agent acts, by generating a
`RIPSTOP.md` file that summarises the repo's active guardrails in a
form agents can read at session start.

The generated file is a static, committed artefact. It is referenced
from the repo's `AGENTS.md` (or equivalent agent-config file) and
loaded by agents alongside their other context. Drift between
`.guardrails.yaml` and `RIPSTOP.md` is detected by a new check and
treated as a finding.

This is non-binding, by design and by necessity. Agent-config files
are advisory — Layer 1 in Ripstop's three-layer model. What this
enhancement does is make Layer 1 *populated by* Layer 2's enforcement
config, eliminating drift between what agents are told and what the
package enforces.

---

## 2. Why this enhancement, why now

Three reasons:

1. **Better developer experience.** Right now, when an agent makes a
  move Ripstop disallows, the failure happens at commit time and the
   agent retries with a corrected approach. With `RIPSTOP.md` in
   context, many of those failures are pre-empted entirely. Same
   correctness, fewer round-trips.
2. **Single source of truth.** Without this enhancement, repos that
  want both enforcement (Ripstop) and pre-action guidance (AGENTS.md)
   must maintain two documents that say the same things in different
   ways. They drift, often within weeks. Generating one from the other
   prevents the drift mechanically.
3. **Tighter pitch.** "Ripstop catches mistakes at the commit
  boundary *and* tells your agent how to avoid making them in the
   first place" is a stronger story for the consulting engagement than
   the boundary alone, with negligible additional implementation cost.

---

## 3. Goals & non-goals

### Goals

- A `ripstop generate-md` CLI command that produces `RIPSTOP.md` from
the resolved guardrails configuration.
- Output formats tuned per agent (Claude Code, Cursor, Codex, Amazon
Q) where the framing meaningfully differs.
- A `ripstop-md-fresh` check that fails when `.guardrails.yaml`
changes without a corresponding regeneration.
- Integration documented in the per-agent config doc — one-line
references from each agent's native config file.

### Non-goals

- Remote / dynamic loading of guardrail content. `RIPSTOP.md` is a
static, committed file; agents do not fetch URLs from agent-config
files at session start (see §4 below).
- Replacing AGENTS.md. `RIPSTOP.md` is *included from* AGENTS.md, not
*instead of* it. AGENTS.md remains the team's authoritative agent
guide; `RIPSTOP.md` is the auto-generated guardrails summary
referenced from it.
- Enforcement of `RIPSTOP.md` itself. The file is advisory; agents
that ignore it still hit the Layer 2 enforcement at commit time.
- Authoring-time guidance (i.e., generating prose from config alone).
The output is structured and declarative, not a polished writeup.

---

## 4. Background — why we don't fetch from a URL

Worth being explicit because it's a natural design instinct that
doesn't survive contact with reality.

Agent-config files (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, etc.)
are loaded as static text at agent session start. None of the major
agents (Claude Code, Cursor, Codex, Amazon Q) fetch URLs referenced
in those files at load time. URLs in agent-config files are
documentation, not directives.

There is also a sound security reason for this default: if
agent-config files fetched remote content, a compromised remote would
silently change every agent's behaviour across every repo using it.
Static local files are safer, even at the cost of some convenience.

The implication for this enhancement: any guardrails guidance reaching
an agent's context must be locally present at session start. The only
practical mechanism is generation-and-commit. We embrace that
constraint rather than fighting it.

---

## 5. The generated file

### 5.1 Shape

`RIPSTOP.md` is short, declarative, and structured. Three sections,
nothing else:

```markdown
# RIPSTOP — Active Guardrails

> Auto-generated from `.guardrails.yaml`. Do not edit by hand —
> regenerate via `ripstop generate-md`. Last generated: <timestamp>
> from config hash <sha>.

## What this repo blocks

The following actions will fail at commit, push, or rebase time:

- **PII patterns in source files** (rule: `pii`)
  Patterns: MSISDN, IMSI, ICCID, email, UK postcode, ACC-XXXXXXXX
  Exempt paths: `test/fixtures/`**
- **Modifications to protected paths without approval trailer**
  (rule: `path-guard`)
  Protected: `infra/`**, `migrations/**`, `*.policy.yaml`
  Trailer to attest approval: `CHANGE-APPROVED: <ticket>`
- **New test-skip annotations without ticket reference**
  (rule: `test-skip`)
  Blocked: `@skip`, `.skip(`, `xit(`, `@Disabled`
- **New runtime dependencies without an ADR** (rule: `dependency-guard`)
  Manifests watched: `package.json`, `requirements.txt`, `pom.xml`
  ADR location: `docs/adr/`
- **Force-pushes, branch deletions, and rebases of pushed commits**
  on protected branches (rule: `history-guard`)
  Protected branches: `main`, `develop`, `release/`*
  Override trailer: `HISTORY-OVERRIDE: <reason>`

## What this repo expects of you

- Read this file before making structural changes.
- If you would touch a protected path, stop and ask the human first.
- If a check fires, read the rule ID and the remediation hint —
  fix the underlying issue rather than bypassing.
- If you genuinely need to bypass, use the trailer specified above
  and reference a ticket in the reason.
- Do not disable, weaken, or modify `.guardrails.yaml` to make a
  check pass. That is a guardrail violation in itself.
- Do not edit this file directly. It is regenerated from config.

## What to do if you trip a guardrail

1. Read the rule ID in the error output (e.g. `pii.msisdn`).
2. Read the remediation hint after the rule ID.
3. Fix the underlying issue. Most rules are clear about what's wrong.
4. If you believe the rule is firing incorrectly, do not bypass.
   Surface the false positive in your PR description so a human can
   decide whether to add an exemption.
5. If a human has authorised a bypass, use the trailer format above.
   Bypasses are logged and reviewed.

---
*Generated by Ripstop v<version>. For questions, see
`agent-guardrails-consumer-playbook.md` or contact the platform team.*
```

That's the entire specification of the file's content. No prose
explanations, no rationale, no philosophy. The agent gets what it
needs to behave correctly, and nothing else.

### 5.2 Why this shape

- **Declarative, not narrative.** Agents handle structured rules
better than they handle prose. Bullets with rule IDs map cleanly to
the same rule IDs in error output, closing the loop.
- **Small.** A typical generated file is well under 200 lines.
Context-window-cheap.
- **Auto-generated header.** The file is clearly marked as generated
with a timestamp and config hash. Humans don't try to edit it;
reviewers immediately see when it's out of date.
- **Trailer references inline.** The agent learns *where* to use the
bypass mechanism alongside *what* will fire — closing the most
common confusion (agent fires the check, doesn't know how to
attest).

---

## 6. Per-agent output format

Most of the file is the same regardless of agent. Three small
variations matter enough to support:

### 6.1 `--format markdown` (default)

The shape shown in §5.1. Suitable for direct inclusion in any
agent-config file that supports markdown reference (`@RIPSTOP.md` in
Claude Code's CLAUDE.md, plain inclusion in Cursor's `.cursorrules`,
etc.).

### 6.2 `--format claude`

Same content, with Claude-Code-flavoured framing:

- A leading section pointing at `agent-guardrails-consumer-playbook.md`
using the `@filename` reference syntax that Claude Code resolves at
session start.
- Use of structured XML-ish blocks where helpful (e.g.,
`<protected_paths>...</protected_paths>`) which Claude tends to weight
more heavily.

### 6.3 `--format cursor`

Same content, optimised for `.cursorrules` inclusion:

- More imperative voice ("Do X. Do not do Y.") which Cursor's rule
parser handles well.
- No XML blocks (Cursor parses plainer text more reliably).
- Section headers in the format Cursor's rule weighting recognises.

### 6.4 Why agent-specific formats at all

One could argue for a single universal format. In practice, each
agent's prompt processing has documented preferences (Claude rewards
structured tags; Cursor rewards imperative bullets; Codex rewards
explicit examples). Producing format variants is a 50-line difference
in the generator and a meaningful difference in adherence rates.

If new agents emerge or existing ones change, format variants are
isolated to one file (`src/generators/markdown.ts`); the rest of the
package is unaffected.

---

## 7. CLI surface

One new subcommand:

```
ripstop generate-md [options]

  Generate RIPSTOP.md from the resolved guardrails configuration.

Options:
  --output <path>       Output path. Default: RIPSTOP.md (repo root)
  --format <fmt>        markdown | claude | cursor | codex | q
                        Default: markdown.
  --check-fresh         Exit non-zero if the existing file is stale.
                        Use as a CI step or pre-commit hook trigger.
                        Does not regenerate; reports drift only.
  --dry-run             Print to stdout, don't write the file.
  --config <path>       Config file path (default: .guardrails.yaml)
```

Exit codes:

- `0` — generation succeeded (or `--check-fresh` confirmed
freshness)
- `1` — `--check-fresh` detected stale output
- `2` — config error
- `3` — internal error
- `5` — write failure (permissions, disk full, etc.)

---

## 8. Freshness check

A new check, `ripstop-md-fresh`, is added to the v1.1 check set.

### 8.1 Mechanism

The generated `RIPSTOP.md` includes a config hash in its header. The
hash is computed over the resolved config (`preset ⊕ plugins ⊕ local ⊕ repo overrides`), not just the literal file contents — this avoids
spurious staleness when the consumer reformats their config or adds
comments.

The check runs at pre-commit and CI. It:

1. Loads the resolved config and computes its hash.
2. Reads the existing `RIPSTOP.md` (if any) and extracts its
  embedded hash.
3. Compares. If they differ, fail with a clear error:

```
✗ ripstop-md-fresh [error] RIPSTOP.md is out of date
    Config has changed since RIPSTOP.md was last generated.
    Regenerate: ripstop generate-md
    rule: ripstop-md-fresh.stale
```

If `RIPSTOP.md` does not exist at all and the check is enabled in
`enforce` mode, the failure is the same with a different message
suggesting initial generation.

### 8.2 Configuration

```yaml
ripstop-md-fresh:
  mode: enforce              # default in presets
  triggers: [pre-commit, ci]
  output_path: "RIPSTOP.md"
  format: markdown           # must match what generate-md was called with
```

### 8.3 Default modes per preset

Adds one row to the preset matrix in §11.1 of the main spec:


| Check              | telco-generic | telco-bss | telco-network | internal-tooling |
| ------------------ | ------------- | --------- | ------------- | ---------------- |
| `ripstop-md-fresh` | warn          | enforce   | enforce       | warn             |


Tier 1 presets enforce because drift on those repos is a real risk.
Lighter presets warn so adoption is gradual.

---

## 9. Integration with existing components

### 9.1 Package layout

Two new files:

```
src/
  generators/
    markdown.ts              # generates RIPSTOP.md from resolved config
    formats/
      claude.ts              # Claude Code variants
      cursor.ts              # Cursor variants
      codex.ts               # Codex variants
      q.ts                   # Amazon Q variants
  checks/
    ripstop-md-fresh.ts      # new check
```

No changes to existing files except registry registration of the new
check and new CLI subcommand.

### 9.2 AGENTS.md inclusion pattern

Documented in `docs/per-agent-config.md`. One-line addition per
agent's native config file.

**Claude Code** (`CLAUDE.md` or `AGENTS.md`):

```markdown
@RIPSTOP.md
```

**Cursor** (`.cursorrules`):

```
# Repo guardrails — see RIPSTOP.md for full details
@import RIPSTOP.md
```

**Codex** (harness configuration):

```yaml
context_files:
  - RIPSTOP.md
```

**Amazon Q** (rules file):

```yaml
include:
  - RIPSTOP.md
```

(Exact syntax verified against current agent docs at implementation
time; the principle is consistent across all four.)

### 9.3 Layered model implication

This enhancement is the first time Ripstop touches Layer 1 of the
guardrails model. The framing in §22.4 of the main spec needs a
small refinement:

> Ripstop is primarily Layer 2. Two checks reach into adjacent
> layers: `working-tree-guard` requires Layer 3 cooperation (agent
> harness), and the generated `RIPSTOP.md` populates Layer 1 (agent
> config) from the same configuration that drives Layer 2
> enforcement. The package remains a Layer 2 product; Layer 1 and
> Layer 3 reach are conveniences that close drift between layers,
> not replacements for properly configured Layer 1 agent files or
> Layer 3 harness sandboxing.

### 9.4 What §22 honesty section needs

The "what the package can and cannot prevent" section gets one
addition under §22.2 *partially prevents*:

> Pre-action agent compliance with guardrails. `RIPSTOP.md`
> generation places the active rules in the agent's session context,
> which raises the probability the agent gets things right first
> time. It does not guarantee compliance — agent-config files are
> advisory, and a determined or jailbroken agent can ignore them.
> The Layer 2 enforcement at commit time remains the binding control.

---

## 10. Consumer-side ergonomics

The consumer playbook (§3 onboarding) adds one wiring step:

```bash
# After installing and creating .guardrails.yaml:
ripstop generate-md
git add RIPSTOP.md
```

And one line to whatever AGENTS.md (or equivalent) the consumer
already has:

```markdown
@RIPSTOP.md
```

A new section between Level 1 (config tuning) and Level 2 (plugins)
in §13 of the playbook — call it "Level 1.5: keep `RIPSTOP.md`
fresh" — covers:

- Regenerate after every `.guardrails.yaml` change
- Treat the regeneration as a config commit, not a code commit
(small, atomic, separate from feature work)
- The freshness check fires if forgotten; this is a feature, not
friction
- Do not edit `RIPSTOP.md` by hand. If the generated content is
wrong for your repo, the fix is in `.guardrails.yaml` or a
custom format

---

## 11. Failure modes

- **Config invalid** → exit 2, no file written, no existing file
modified.
- **Output path not writable** → exit 5 with diagnostic.
- **Existing `RIPSTOP.md` has been hand-edited** → detectable via
the embedded hash. The generator writes anyway (overwriting the
edits), but logs a warning. The freshness check would also have
caught this earlier.
- **Multiple format variants requested with conflicting paths** —
not supported; one repo, one `RIPSTOP.md`. If a repo wants
per-agent variants, generate multiple files at different paths and
reference each from its respective agent config. Rare; documented
but not optimised for.

---

## 12. Acceptance criteria

The enhancement ships when:

1. `ripstop generate-md` produces a valid `RIPSTOP.md` for the
  `telco-generic`, `telco-bss`, `telco-network`, and
   `internal-tooling` presets.
2. All four format variants (`markdown`, `claude`, `cursor`,
  `codex`, `q`) produce output that round-trips through their
   respective agents in a smoke test (i.e., the agent acknowledges
   the rules when prompted).
3. The `ripstop-md-fresh` check passes on a freshly generated repo
  and fails when `.guardrails.yaml` is modified without
   regeneration.
4. The freshness check is added to the four standard presets at the
  modes listed in §8.3.
5. `docs/per-agent-config.md` is updated with the inclusion pattern
  for each agent.
6. The consumer playbook §3 and §13 are updated.
7. `agent-guardrails-spec.md` §22.4 and §22.2 are updated with the
  refined layer-model framing.
8. Generated files for the four presets are committed under
  `test/fixtures/generated-md/` as snapshot tests.

---

## 13. Effort estimate

For one engineer with the rest of Ripstop already built:

- **Day 1:** generator scaffold, markdown format, snapshot tests for
one preset.
- **Day 2:** remaining format variants (claude, cursor, codex, q),
snapshot tests for all four presets.
- **Day 3:** `ripstop-md-fresh` check, integration into preset
matrix, CLI subcommand wiring, exit code handling.
- **Day 4:** documentation updates (per-agent config doc, playbook,
main spec §22 refinements), pilot install in a real repo,
end-to-end agent test.

Three to four days, scoped tightly. Substantially less if the
generator can reuse existing config-resolution code, which it should.

This sits comfortably as a v1.1 deliverable after the v1.0 core
ships, or as a v1.0 stretch if the original four-day window has
slack.

---

## 14. Open questions

1. **Should `generate-md` run automatically as part of `ripstop
  check`, or only when invoked explicitly?** Current spec says  explicit. Argument for auto: reduces forgetting. Argument  against: implicit file mutations are surprising. Lean explicit;`  ripstop-md-fresh` provides the safety net.
2. **Should the file name be configurable?** Probably yes, default
  `RIPSTOP.md` but consumers may want `.guardrails-summary.md` or
   similar. Adds a config field, no implementation cost.
3. **Should there be a way for `RIPSTOP.md` to include consumer-
  authored prose alongside the generated content?** A
   "consumer-supplied preamble" file that gets prepended? Useful but
   adds complexity. Defer to v1.2 unless adoption demand is high.
4. **Should plugin-supplied checks contribute to `RIPSTOP.md`?**
  Yes, by the same `Check` interface — each check declares its own
   summary text. This is implicit in the design but worth being
   explicit about during implementation.

These are deliberately small and specific. The shape of the
enhancement is settled; these are tuning decisions for the
implementation phase.