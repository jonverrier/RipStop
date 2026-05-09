# Ripstop Enhancement Spec — Self-Protection of Guardrails Config

**Status:** Implemented in **npm 0.2.x** (path-guard presets, `RIPSTOP.md`
self-protection section, Claude deny JSON, `reflog-witness`,
`recover --config-history`); this document remains the design rationale.

**Type:** Enhancement spec (shipped in **0.2.0+** — guardrails self-protection
at commit time plus witness forensics for config drift).
**Companion to:** `ripstop-spec.md`,
`ripstop-consumer-playbook.md`, and
`ripstop-markdown-enhancement-spec.md`
**Audience:** The engineers extending Ripstop to protect its own
configuration and state from agent modification.

---

## 1. Summary

Ripstop's guardrails are only as strong as the configuration that
defines them. An agent that wants to make a check pass can
short-circuit the entire system by editing `.guardrails.yaml` —
disabling a rule, broadening an exemption, switching mode to `off` —
in the same commit as the work that triggered the check. **0.0.x–0.1.x**
did not yet combine path-guard on config files, extended witness capture,
and generated self-protection copy the way **0.2.x** does.

This enhancement closes that gap with layered self-protection:

1. **Agent-config-level deny rules** — generated alongside
  `RIPSTOP.md`, instructing each agent (and where supported,
   harness-enforcing) that guardrails configuration files are not
   to be modified.
2. **`path-guard` defaults strengthened** — every preset's
  `protected_paths` list gains `.guardrails.yaml`, `.guardrails/`,
   and `RIPSTOP.md`. Modifications require an explicit
   `CHANGE-APPROVED: <ticket>` trailer.
3. **Witness capture extended** — `reflog-witness` snapshots the
  contents of `.guardrails.yaml` at every invocation, so even if
   the file is deleted or rewritten, **witness review** (manual or
   scripted) can detect and reconstruct it.

The honest framing: this makes casual misconfiguration much harder
and deliberate misconfiguration visible. It does not make Ripstop
tamper-proof. A determined agent with shell access can still
overwrite anything.

---

## 2. The threat model, plainly

Three failure modes this enhancement addresses, in increasing severity:

**Casual self-bypass.** Agent makes a change that fires a check.
Rather than fixing the underlying code, the agent edits
`.guardrails.yaml` to silence the check — usually by adding an
exemption, occasionally by flipping mode to `off`. The commit
contains both the original change and the config edit. CI passes,
guardrails are now weaker, nobody notices until the next **config /
witness review** you schedule.

This is the dominant failure mode. It is not malicious; it is the
agent following the path of least resistance. **0.1.x** catches it
only retrospectively (in audit log review). This enhancement catches
it at commit time.

**Quiet erosion.** A team adopts more aggressive local exemptions
than **governance owners** would approve, often introduced commit-by-commit
by agents reacting to friction. Each individual change looks
reasonable; the cumulative drift is large. The repo's effective
guardrails diverge silently from the preset baseline.

This enhancement does not directly prevent erosion, but the
`CHANGE-APPROVED` trailer requirement creates a paper trail and a
**periodic drift review** (if your org runs one) catches accumulation.

**Deliberate sabotage.** A jailbroken or adversarial agent (or a
human acting in bad faith) deletes or rewrites `.guardrails.yaml`,
removes the witness log, and commits work that should have been
blocked.

This is the case the enhancement explicitly does not fully prevent.
What it does provide: detection. The witness log entries from prior
sessions show the configuration that existed before the change, and
the audit log shows the moment of change. Recovery and accountability
are possible even if prevention failed.

---

## 3. Goals & non-goals

### Goals

- Add `.guardrails.yaml`, `.guardrails/`, and `RIPSTOP.md` to every
preset's `path-guard` `protected_paths` list, requiring a
`CHANGE-APPROVED` trailer for modifications.
- Generate agent-specific deny rules in `RIPSTOP.md` and (where the
agent supports harness-level enforcement) in agent-native config
files.
- Extend `reflog-witness` to capture a snapshot of
`.guardrails.yaml`'s contents at each invocation, so the active
configuration is forensically recoverable.
- Document the threat model and the layered defence in the §22
honesty section of the main spec.

### Non-goals

- Tamper-proofing. A shell-equipped agent can defeat any of these
controls in isolation. The enhancement is layered defence, not
absolute prevention.
- Encrypting or signing `.guardrails.yaml`. Cryptographic integrity
is overkill for this threat model and creates significant
operational pain (key management, rotation) for marginal benefit.
- Protecting central library code. This enhancement protects the
*consuming* repo's configuration. Central-library integrity is a
separate concern handled via package signing and supply-chain
hygiene (out of scope for this spec; see main spec §14).
- Protecting against compromised package installations
(e.g. malicious version of `@yourfirm/ripstop`). Same reason.

---

## 4. The three layers, in detail

### 4.1 Layer 1 — Agent-config deny rules

Generated by `ripstop generate-md` alongside the existing
`RIPSTOP.md` content. The generated file gains a fourth section:

```markdown
## What you must not modify

The following files configure the guardrails themselves. Modifying
them to disable, weaken, or work around a check is a guardrail
violation in itself, and will be flagged in review.

- `.guardrails.yaml` — guardrails configuration
- `.guardrails/` — guardrails state, snapshots, and witness logs
- `.guardrails/checks/` — local check implementations (if present)
- `RIPSTOP.md` — auto-generated; edit `.guardrails.yaml` instead

If you genuinely need to change one of these — onboarding a new
check, tuning a pattern after a central library update, adjusting
an exemption with platform-team approval — open the change as a
separate PR. Do not modify these files in the same commit as the
work that triggered a check.

The commit that modifies guardrails configuration must carry the
trailer:

    CHANGE-APPROVED: <ticket-id> <reason>
```

For agents whose harness supports machine-enforced denials, a
parallel native-format file is also generated:

**Claude Code** (`.claude/settings.json` patch, generated as
`.claude/settings.ripstop.json` and merged via the install script):

```json
{
  "permissions": {
    "deny": [
      "Edit(.guardrails.yaml)",
      "Edit(.guardrails/**)",
      "Edit(RIPSTOP.md)",
      "Write(.guardrails.yaml)",
      "Write(.guardrails/**)"
    ]
  }
}
```

**Cursor** (`.cursorrules` addition):

```
NEVER modify .guardrails.yaml, .guardrails/, or RIPSTOP.md.
These files configure the guardrails themselves. If you need to
change them, surface the request to the human and stop. Do not
attempt to bypass a failing guardrail check by editing config.
```

**Codex / OpenAI tools** — harness-level denials if the harness
supports them; markdown-only otherwise.

**Amazon Q** — rules-file equivalent.

The honest distinction: only Claude Code's `permissions.deny` is
genuinely *enforced* at the harness level. The others are advisory
in the same way `RIPSTOP.md` itself is advisory.

### 4.2 Layer 2 — `path-guard` defaults

The existing `path-guard` check is the binding control. No code
changes are required; only the preset defaults change.

Every preset gains the following entries in `path-guard`'s
`protected_paths`:

```yaml
path-guard:
  protected_paths:
    # Existing per-preset entries (infra/**, migrations/**, etc.)
    # ...
    # New universal entries — added in 0.2.x presets
    - ".guardrails.yaml"
    - ".guardrails/**"
    - "RIPSTOP.md"
  approval_trailer: "CHANGE-APPROVED"
```

Effect: any commit modifying these files without
`CHANGE-APPROVED: <ticket>` in the message fails at pre-commit and CI.

This is the layer that actually holds, because `path-guard` runs
regardless of agent and runs against any commit, including those
made via direct shell. Agent-config bypass is irrelevant here.

### 4.3 Layer 3 — Witness capture of config

`reflog-witness` is extended to capture `.guardrails.yaml`'s
contents (or its hash, plus the actual content if it has changed
since the last capture) on every invocation. The witness log already
records: timestamp, HEAD SHA, branch, reflog entries, stash
inventory. **0.2.x** adds:

```jsonl
{
  "timestamp": "...",
  "config": {
    "path": ".guardrails.yaml",
    "hash": "<sha256>",
    "content": "<full text, only when changed since last capture>"
  },
  "ripstop_md_hash": "<sha256>"
}
```

Storage cost is minimal (the file is small; only deltas are stored).
The benefit is forensic: if `.guardrails.yaml` is deleted, weakened,
or replaced between two witness invocations, the prior version is
recoverable from the log.

This layer does not prevent anything. It ensures that prevention
failures are detectable and recoverable.

---

## 5. Configuration

No new top-level config keys are introduced. The enhancement is
realised through existing mechanisms:

- `path-guard.protected_paths` — preset defaults strengthened
- `reflog-witness.capture_on` — same triggers as before; new
behaviour is internal to the check
- `ripstop generate-md` — new format variants emit the deny files

Consumers can override the new `path-guard` defaults the same way
they can override anything else, with the usual governance:
removing `.guardrails.yaml` from `protected_paths` is a config change
that requires platform-team sign-off in tier 1 and tier 2 repos.

A new field is added to the `path-guard` config to support
self-protection messaging (so the error is clear when the protected
file is `.guardrails.yaml` rather than a generic infra path):

```yaml
path-guard:
  self_protection_message: |
    You are attempting to modify a guardrails configuration file.
    Modifying these files to bypass a check is itself a guardrail
    violation. Open this change as a separate PR with rationale.
```

Used only when the file matched is one of `.guardrails.yaml`,
`.guardrails/**`, or `RIPSTOP.md`. Standard error message used
otherwise.

---

## 6. CLI surface

No new subcommands. Existing commands gain new behaviour:

```
ripstop generate-md
```

Now also generates the agent-native deny files
(`.claude/settings.ripstop.json`, etc.) into the appropriate
locations when run with format flags. Output paths documented in
`docs/per-agent-config.md`.

```
ripstop check
```

The existing `path-guard` check now naturally enforces the new
protected paths via the preset defaults; no new flags. The
enhanced error message (per §5) appears automatically when the
matched file is a guardrails-config file.

```
ripstop recover
```

Gains the ability to surface prior `.guardrails.yaml` snapshots
from the witness log:

```
ripstop recover --config-history [--since <expr>]

  Show captured snapshots of .guardrails.yaml from the witness log,
  for forensic review of configuration changes.
```

Useful when investigating "when did this exemption appear?" or
"what did the config look like a month ago?"

---

## 7. Per-agent format details

### 7.1 Claude Code

Two files generated:

- `RIPSTOP.md` (existing) — adds the §4.1 self-protection section
- `.claude/settings.ripstop.json` (new) — partial settings file
with `permissions.deny` rules

Consumer integrates via the merge utility documented in
`docs/per-agent-config.md`:

```bash
ripstop generate-md --format claude
# Then merge .claude/settings.ripstop.json into .claude/settings.json
# (the install script handles this idempotently)
```

The merge is shallow: `permissions.deny` arrays are concatenated
and deduplicated. Other Claude Code settings are untouched.

### 7.2 Cursor

One file generated:

- `RIPSTOP.md` — with self-protection section using imperative
voice that Cursor's parser handles well

The `.cursorrules` integration is unchanged (still
`@import RIPSTOP.md` or equivalent). Cursor has no mechanism for
machine-enforced file denials in **0.2.x**; the
markdown is the only available channel.

### 7.3 Codex / OpenAI tools

Harness-dependent. If the consumer's harness supports per-tool
permissions, generate the relevant config block. Otherwise,
markdown-only. The per-agent doc explains both paths and notes
which harnesses support which.

### 7.4 Amazon Q Developer

Rules-file equivalent of the Cursor approach. Q's IAM-based
permissions can also restrict file modifications when configured;
documented in the per-agent doc but the IAM configuration itself
is the consumer's responsibility, not Ripstop's.

---

## 8. Failure modes

- **Agent edits `.guardrails.yaml` and the commit lacks the
trailer** → `path-guard` fires, commit blocked. Standard failure
path. Self-protection message appears in the error.
- **Agent edits `.guardrails.yaml` with the trailer but the
rationale is bogus** → commit succeeds; bypass is logged in
audit log; surfaced in **your review process**. This is the gap that
process must fill.
- **Agent attempts to delete `.guardrails/` or rewrite witness
log** → `path-guard` blocks the commit. If the deletion happens
outside Git (direct `rm`), filesystem snapshot recovery (per
main spec §22.3) is the available control; Ripstop itself does
not prevent shell-level destruction.
- **Agent edits `.claude/settings.json` to remove the deny
rules** → `.claude/settings.json` is added to the protected
paths list in **0.2.x** presets specifically to defend against this.
Same trailer requirement.
- **Generated deny rules conflict with existing
`.claude/settings.json` content** → merge is shallow and
additive; conflicts are surfaced as warnings during
`generate-md`, not silently overwritten.
- **Witness log grows large from frequent config snapshots** →
only deltas stored; periodic compaction documented in the
consumer playbook §10's audit-rotation guidance.

---

## 9. What changes in the existing specs

### 9.1 In `ripstop-spec.md`

- **§7 config schema example** — `path-guard` example shows the
new universal entries
- **§10.2 `path-guard`** — rationale paragraph extended to mention
self-protection
- **§11.1 preset matrix** — note added that all presets include
guardrails-config files in `path-guard` protected paths
- **§22.1** — add "self-bypass via config edit" to the list of
failures the package reliably prevents
- **§22.2** — add "self-protection of agent-config files (Cursor,
Codex, Q)" as a partially-prevented case, since only Claude Code
enforces these at the harness layer
- **§22.4** — refine the layered model framing; the package now
reaches into Layer 1 with deny rules where supported

### 9.2 In `ripstop-consumer-playbook.md`

- **§3 onboarding** — wiring step for the agent-native deny files
(where applicable)
- **§5 bypass workflow** — clarify that bypassing a check by
editing `.guardrails.yaml` is itself a guardrail violation, not
a legitimate bypass
- **§6 override governance** — add explicit text on
guardrails-config edits requiring **designated reviewer sign-off** in
tier 1 and tier 2 repos (when your org uses tiers)
- **§10 incident recovery** — new sub-section on
`ripstop recover --config-history` for investigating
configuration drift

### 9.3 In `ripstop-markdown-enhancement-spec.md`

- **§5.1** — fourth section ("What you must not modify") added to
the generated file shape
- **§6** — agent-native deny file generation added to the
per-agent format variants

---

## 10. Acceptance criteria

The enhancement ships when:

1. Every preset's `path-guard` config includes
  `.guardrails.yaml`, `.guardrails/`**, and `RIPSTOP.md` in
   `protected_paths`.
2. Test fixtures cover the case of an agent attempting to edit
  `.guardrails.yaml` in the same commit as a check-firing change,
   confirming the commit is blocked.
3. `ripstop generate-md --format claude` produces both
  `RIPSTOP.md` (with the new self-protection section) and a
   merge-ready `.claude/settings.ripstop.json`.
4. `ripstop generate-md --format cursor` produces `RIPSTOP.md`
  with the imperative self-protection section.
5. `reflog-witness` captures `.guardrails.yaml` content (or hash +
  delta) on every invocation, demonstrated by integration test.
6. `ripstop recover --config-history` reads back captured
  snapshots in chronological order.
7. The self-protection message appears in `path-guard` errors when
  the matched file is a guardrails-config file, and the standard
   message appears otherwise.
8. Documentation updates in §9 are landed in the relevant
  companion docs.
9. The §22 honesty section of the main spec is updated to reflect
  what the enhancement does and does not prevent — including
   explicit acknowledgement that shell-level destruction is
   outside the package's reach.
10. One pilot repo runs the enhancement for two weeks with no
  false positives on legitimate config changes.

---

## 11. Effort estimate

For one engineer with **`generate-md` / `ripstop-md-fresh` (0.1.x) already shipped**:

- **Day 1:** preset config updates, `path-guard` self-protection
message, integration tests for the protected-files-block-commit
case.
- **Day 2:** generator extensions for Claude Code's
`.claude/settings.ripstop.json` and the `RIPSTOP.md`
self-protection section across all format variants.
- **Day 3:** `reflog-witness` extension for config capture, new
`recover --config-history` subcommand, integration tests.
- **Day 4:** documentation updates across all three companion
specs, consumer-playbook updates, pilot install, two-week
observation window begins.

Total: 3–4 days of build, plus the observation window. The
observation window matters because false positives on legitimate
config tuning would create more friction than the enhancement
prevents; ship behind a `preview: true` flag if the window can't
fit the release schedule.

---

## 12. Honest framing — what this enhancement is and isn't

Worth being explicit because the temptation to oversell is real.

**This enhancement is** layered defence against the most common
self-bypass failure mode (agent edits config to silence a check),
combined with forensic capture so the rare cases that get through
are detectable.

**This enhancement is not** tamper-proofing. A determined agent
with shell access can still:

- Run `git commit --no-verify` to skip pre-commit hooks
- Use `rm` to delete files outside Git's view
- Edit `.husky/pre-commit` to a no-op (though `path-guard` would
catch this too, when those paths are protected in **0.2.x**)
- Modify the witness log directly (though it's append-only by
convention, the file system permits writes)

For absolute prevention of these, server-side branch protection,
filesystem-level snapshots, and out-of-band audit infrastructure
are needed. Those are outside Ripstop's scope and explicitly
called out in the main spec's §22.3.

The selling line: *"Ripstop makes casual misconfiguration much
harder, and makes deliberate misconfiguration visible. It does not
make the guardrails impossible to bypass — that requires
controls that live outside the package, in **your org’s**
broader stack."*

That's a strong, honest, defensible claim. Anything stronger is
overpromising and will erode trust on first incident.

---

## 13. Open questions

1. **Should `.husky/pre-commit` and other hook shims be added to
  the protected paths?** Currently no, because legitimate
   onboarding edits them. Argument for: an agent disabling the
   shim defeats `path-guard` itself for that commit. Argument
   against: false-positive rate on initial install is high. Lean
   no, but worth tracking in the audit log if shim contents
   change.
2. **Should the self-protection message be localised?** Probably
  not for **0.2.0** alone — the message is for agents and **engineering
   leads**, both of which operate in English in the first **public OSS**
   environment. Revisit if Ripstop sees adoption outside that
   context.
3. **Should `reflog-witness` capture full content always, or only
  deltas?** Current spec says deltas. Argument for full always:
   simpler implementation, no edge cases when the log is
   compacted. Argument for deltas: storage cost over time. Lean
   deltas, with a configurable threshold (default 1MB) above
   which only hashes are stored.
4. **Should there be a "self-protection bypass"** — a way for **operators**
  to legitimately disable self-protection for **debugging**? Probably yes,
  via a config flag that's itself
   change-controlled. `self_protection: off` in
   `.guardrails.yaml`, where setting it requires the
   `CHANGE-APPROVED` trailer (recursively guarded). Worth
   building only if the operational need materialises; defer.

These are tuning decisions for implementation, not blockers for
the spec.