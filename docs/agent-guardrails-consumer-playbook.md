# `ripstop` / `agent-guardrails` — Consumer Playbook

**Status:** Draft v0.1
**Audience:** Repo owners and engineering teams adopting the package.
**Companion to:** `agent-guardrails-spec.md` (read that for what the package
*is*; this document is for how to *use* it well.)

---

## 1. Who this is for

You own a repository in which AI coding agents (Claude Code, Cursor, Codex,
Amazon Q) make changes. The platform team has installed `ripstop`
in your repo, or asked you to install it. This document tells you how to
live with it day-to-day.

If you're building or maintaining the package itself, read the spec instead.

---

## 2. The bargain

The package gives you:

- A working set of guardrails on day one, tuned by the central preset
- Findings that are specific, actionable, and machine-readable for agents
- An audit trail your security team will accept as evidence
- A clear escape hatch for the genuinely-broken-cases

In exchange, your team commits to:

- **Respond to warn-only findings within the release they appear.** A check
that's `warn` today will be `enforce` in a future release. If you ignore
warnings, your CI breaks on upgrade.
- **Justify and log every `mode: off` override.** Disabling a check
silently is the failure mode this whole system is designed to prevent.
- **Treat bypasses as exceptional, not routine.** Repeated bypasses on the
same check are a signal to fix the underlying problem or request a config
change centrally.
- **Pin the package version and upgrade deliberately.** Auto-upgrade on
major versions will break your CI. That's not a bug.
- **Report false positives back centrally** rather than silently exempting
them locally. One team's false positive is everyone's false positive.

These obligations are formalised in §21 of the spec. The rest of this
document is how to meet them without it being a chore.

---

## 3. Onboarding — your first day

### 3.1 Install

If your repo is TS/Node:

```bash
npm install --save-dev @jonverrier/ripstop
npm install --save-dev husky
npx husky init
```

If your repo is Java/Python/Go (no Node toolchain):

```bash
# Pull the binary from the internal artefact store
curl -fsSL https://artifacts.internal/guardrails/install.sh | sh

# Confirms the binary is on PATH
ripstop version
```

### 3.2 Wire the shims

Four hook files, all one line each. Husky manages them in Node repos; in
non-Node repos they live in `.git/hooks/` directly.

`**.husky/pre-commit**` — for staged-content checks such as `pii`,
`test-skip`, `dependency-guard`, `reflog-witness`, and
`working-tree-guard` (orphan detection):

```bash
#!/usr/bin/env sh
npx ripstop check --staged --trigger pre-commit
```

`**.husky/commit-msg**` — for trailer-based checks such as `path-guard`
and bypass reason validation. `pre-commit` cannot do this reliably because
Git has not created the final commit message yet:

```bash
#!/usr/bin/env sh
npx ripstop check --staged --trigger commit-msg --commit-msg-file "$1"
```

`**.husky/pre-push**` — for `history-guard` and `reflog-witness`:

```bash
#!/usr/bin/env sh
npx ripstop check --trigger pre-push
```

`**.husky/pre-rebase**` — for `history-guard` and `reflog-witness`:

```bash
#!/usr/bin/env sh
npx ripstop check --trigger pre-rebase
```

`**.github/workflows/guardrails.yml**` (or your CI equivalent):

```yaml
name: guardrails
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: npx ripstop check --diff origin/${{ github.base_ref }} --trigger ci
```

For non-Node repos, replace `npx ripstop` with the binary path
(`ripstop`, or the compatibility alias `agent-guardrails`) and put the files in `.git/hooks/` instead of
`.husky/`.

That's the entire wiring. You should never need to edit these files
again.

### 3.2a Generate `RIPSTOP.md` for agents

After `.guardrails.yaml` exists, generate a short, auto-updated summary
that agents load at session start (see `docs/per-agent-config.md` for
one-line inclusion in Claude Code, Cursor, Codex, and Amazon Q):

```bash
npx ripstop generate-md
git add RIPSTOP.md
```

Add a single reference from your `AGENTS.md` (or equivalent) to
`RIPSTOP.md` so the active guardrails sit in Layer 1 context. The
`ripstop-md-fresh` check (when enabled) fails if the file is missing or
stale relative to the resolved configuration — regenerate with the same
command after any config change.

### 3.3 Pick a preset

Create `.guardrails.yaml` at the repo root:

```yaml
repo:
  name: <your-repo-name>
  domain: <bss | oss | network | tooling>
  tier: <1 | 2 | 3>      # see "Tier" below

extends: "@jonverrier/ripstop/presets/<preset-name>"

# Start everything in warn mode. You'll flip to enforce after triage.
# Note: history-guard and reflog-witness should go straight to enforce —
# they have no false-positive surface and recovery data is precious.
checks:
  pii:                 { mode: warn }
  path-guard:          { mode: warn }
  test-skip:           { mode: warn }
  dependency-guard:    { mode: warn }
  history-guard:       { mode: enforce }
  reflog-witness:      { mode: enforce }
  working-tree-guard:  { mode: warn }
```

Preset choice:

- BSS / billing / CRM / customer-data → `telco-bss`
- Network config / OSS → `telco-network`
- Internal tools, no customer data → `internal-tooling`
- Unsure → `telco-generic` (you can switch later)

**Tier** drives governance behaviour throughout this playbook:

- **Tier 1** — production, customer-facing or revenue-bearing. Strictest
governance.
- **Tier 2** — production, internal-facing or supporting. Standard
governance.
- **Tier 3** — non-production, sandboxes, experiments. Light governance.

If unsure, ask the platform team rather than guessing. Misclassification
is itself flagged in quarterly review.

### 3.4 First dry run

```bash
ripstop check --all --format human
```

This scans the entire repo and prints findings. Do not panic at the count.
A first-run scan on a long-lived repo typically produces dozens to hundreds
of findings; that's why we start in warn mode.

### 3.5 Triage the findings

Sort findings into four buckets:

1. **Real PII or real policy violations** → fix them. This is what the
  package is for.
2. **Test fixtures with synthetic data** → add a path exemption:
  ```yaml
   pii:
     mode: warn
     exemptions:
       - path: "test/fixtures/**"
         reason: "Synthetic test data, reviewed by [name] on [date]"
  ```
3. **False positives** (regex too aggressive on legitimate code) → **report
  centrally first** (see §8). Add a local exemption only if you need to
   ship before the central fix lands.
4. **Findings on third-party code you don't control** (vendored libs,
  generated code) → path exemption with reason.

After triage, run `--all` again. The remaining findings should be ones you
intend to fix, not ones you're going to live with.

### 3.6 Flip to enforce

Once findings are zero (or you have explicit, justified exemptions for the
remainder), update `.guardrails.yaml`:

```yaml
checks:
  pii:           { mode: enforce }
  path-guard:    { mode: enforce }
  test-skip:     { mode: warn }     # leave this one warn until you're sure
  dependency-guard: { mode: enforce }
```

Open a PR with the change. The PR description should note: "Flipping to
enforce. Triaged N findings: M fixed, K exempted (see config)."

You're done with onboarding. Allow a week.

---

## 4. Day-2 operations

### 4.1 Reading a finding

A finding looks like this:

```
✗ pii [error] src/handlers/customer.ts:42
    Match: pattern "msisdn" — found "+447700900123"
    PII must not appear in source. Use fixtures/synthetic.ts.
    rule: pii.msisdn
```

Five things to read:

- **Check** (`pii`) — which check fired
- **Severity** (`error`) — fail vs. warn
- **Location** (`src/handlers/customer.ts:42`) — where to look
- **Message** — what's wrong
- **Rule ID** (`pii.msisdn`) — stable identifier; use this when reporting
false positives or requesting central changes

### 4.2 Triaging false positives

A false positive is a finding the package raised that, on inspection, is
not actually a violation. Do not just exempt it locally and move on. The
correct workflow:

1. Confirm it's a false positive by reading the rule and the matched line.
2. Open an issue against the central library repo with: rule ID, the
  matching string (redacted if needed), the surrounding code context, and
   why it's a false positive.
3. The platform team responds within the SLA (see §4.5).
4. **If you need to ship before the fix lands**, add a local exemption
  *referencing the issue*:
5. When the central fix lands, remove the local exemption.

The "reason" field is not bureaucratic theatre. It is what your future self
or your security auditor reads when asking "why is this disabled?"

### 4.3 Local pattern vs. central pattern

Some patterns are genuinely repo-specific. Some are not. Use this rule:

- **If the pattern would be useful in another team's repo → request it
centrally.** Internal account ID formats, organisation-wide PII patterns,
shared infrastructure markers all belong in a preset, not in your config.
- **If the pattern is genuinely local → add it via `extra_patterns`.**
References to a deprecated internal library only your repo uses, a
legacy ID format only your domain has, etc.

When in doubt, request it centrally and let the platform team decline.
Adding to a preset is cheap; removing a duplicated pattern from twenty
repos is expensive.

### 4.4 Requesting an exemption

There are two kinds:

**Local exemption** (in your `.guardrails.yaml`):

- Path-based or line-based
- Always requires `reason`
- Visible in the audit log
- No central approval required for `warn` mode
- For `enforce` mode in `tier: 1` repos: requires platform-team sign-off
via PR review (see §6)

**Central exemption** (a change to a preset):

- Used when the same exemption is right for many repos
- Requested via the central library's issue tracker
- Reviewed by the platform team

### 4.5 SLAs from the platform team

- **False positive in default pattern set:** acknowledged within 1 working
day, fix or workaround within 5 working days.
- **New pattern request:** acknowledged within 3 working days, decided
within 10 working days.
- **New check request:** acknowledged within 5 working days, decision
(yes / no / later) within one quarterly planning cycle.
- **Security-impacting issue** (a finding type the package missed that it
should have caught): treat as P2, acknowledged same day, fix targeted
within 5 working days.

If the SLA isn't being met, escalate via §10.

---

## 5. The bypass workflow

Bypasses exist for genuine emergencies. Release-night incidents, audit
deadlines, the one weird case the package authors didn't anticipate. They
are not for "I don't have time to look at this finding."

### 5.1 How to bypass

Add a trailer to your commit message:

```
Fix urgent customer-data export bug

GUARDRAILS-BYPASS: pii.email
GUARDRAILS-BYPASS-REASON: P1 incident INC-9921 — exported test data
contains email pattern in column header. Not real PII. Fix lands in
PR #1847 within 24h.
```

Both lines are required. The check name must match a rule that fired.
The reason must be specific, time-bounded, and reference a ticket.

`**history-guard` has its own alias.** Force-pushes and rebases of
shared history use a separate trailer because reviewers want to spot
them at a glance:

```
Squash feature commits before merge

HISTORY-OVERRIDE: PR #1923 — squashing 14 WIP commits into one.
Branch is feature/billing-refresh, not yet merged to main.
```

Mechanically these are the same — both produce identical audit log
entries — but the surface form differs. New rule-specific aliases
require central approval; ad-hoc proliferation defeats the point.

### 5.2 What gets logged

Every bypass appends an entry to the configured audit log. By default this
is `.git/ripstop/audit.jsonl`, so ordinary hook runs do not dirty the
working tree:

```json
{
  "timestamp": "2026-05-04T14:22:31Z",
  "type": "bypass",
  "rule": "pii.email",
  "author": "jverrier",
  "commit": "abc123",
  "reason": "P1 incident INC-9921 — ...",
  "ticket": "INC-9921"
}
```

Your repo owner reviews this log weekly. The platform team aggregates
across repos monthly and surfaces patterns.

### 5.3 What's a "pattern" worth surfacing

- Same author bypassing the same rule more than twice in a quarter
- Any rule bypassed by more than three teams in a month (suggests the rule
is mis-tuned)
- Bypasses without a ticket reference (should not be possible; if they
are, it's a bug)
- Bypasses on `tier: 1` repos always go to a human reviewer

### 5.4 Escalation if bypass is denied or contested

If you believe a bypass was warranted but it's been challenged in review,
the path is: repo owner → platform team office hours → eng leadership.
Don't argue in commit messages.

---

## 6. Override governance

`mode: off` is the strongest local override and the most dangerous. It
means a check is silently not running.

### 6.1 What you can do without approval

- Set `mode: warn` on any check (downgrading from enforce)
- Add path or line exemptions in `tier: 2` and `tier: 3` repos with a
`reason`
- Add `extra_patterns` (additive, never disables anything)

### 6.2 What requires platform-team sign-off

- `mode: off` on any check, in any repo
- Path exemptions in `tier: 1` repos
- Removing `protected_paths` entries
- Disabling the audit log

Sign-off is a PR review from the `@platform-guardrails` group. The PR
description must include: rationale, scope (this repo only? this domain?
estate-wide?), expiry date or condition for re-enabling.

### 6.3 What the central team monitors

Quarterly, the platform team reviews:

- All `mode: off` overrides across the estate
- All exemptions older than 6 months (are they still needed?)
- Repos whose `.guardrails.yaml` significantly diverges from their preset

This isn't surveillance theatre. It's how the package stays calibrated. A
preset that everyone overrides is a preset that's wrong.

---

## 7. Upgrade discipline

### 7.1 How to consume new versions

Pin in `package.json` (or the binary version file). Configure Renovate or
equivalent with this rule:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["@jonverrier/ripstop"],
      "automerge": false,
      "schedule": "before 9am on monday",
      "labels": ["guardrails-upgrade"],
      "minimumReleaseAge": "3 days"
    }
  ]
}
```

Why: `automerge: false` because guardrail upgrades can break CI. The
3-day minimum age lets early-adopter teams hit the bugs first. Monday
morning means it's the first thing your week's PR reviewer sees, not the
last thing on Friday afternoon.

### 7.2 Triaging a minor version bump

A minor version may add new checks in `warn` mode. When a minor lands:

1. Merge the upgrade PR.
2. Run `ripstop check --all` locally.
3. If new findings appear, triage them the same way you triaged onboarding
  findings (§3.5).
4. The new check will flip to `enforce` in the next major. **You have one
  release cycle to respond.** Do not let warn findings accumulate.

### 7.3 Migrating across a major version

A major version means at least one of:

- A previously-passing repo may now fail
- The config schema has changed
- A check's semantics have changed

The release notes will state the migration steps explicitly. Treat a major
upgrade as a small project, not a Renovate auto-merge:

1. Read the release notes end-to-end.
2. Run the upgrade in a branch, with `--mode warn` globally as a safety net.
3. Triage and fix findings.
4. Update config to the new schema if required.
5. Restore production modes per check.
6. PR review by someone other than the author.

Estimated effort: half a day to two days, depending on what changed and
how clean the repo was at the previous version.

---

## 8. Feedback into the central library

Your team is the closest source of signal on whether the package works in
practice. Use the channels:

### 8.1 GitHub issues on the central repo

For: false positives, missed cases, pattern requests, bug reports,
documentation gaps.

Issue template includes: rule ID, repo context, expected vs. actual
behaviour, minimum reproducing fixture if possible.

### 8.2 Office hours

The platform team runs a 30-minute office hours every other Wednesday.
Drop in for: anything you can't articulate in an issue, design discussions
on new checks, advice on a tricky exemption, complaints.

### 8.3 The `#guardrails` Slack / Teams channel

For: quick questions, "is this a bug or my mistake," sharing patterns that
worked. Not for incident response.

### 8.4 Quarterly retrospective

Every quarter the platform team publishes: top findings across the estate,
which checks fired most often, bypass rate trends, false positive rate,
what's coming in the next release. This is your chance to push back on
direction. Read it.

---

## 9. Common scenarios

**"My PR is blocked by a finding I think is wrong, and I need to ship today."**
File the false positive issue (§4.2 step 2), add a local exemption with the
issue link in the reason, ship. Remove the exemption when the central fix
lands. Do not bypass for this — bypass is for incidents, not disagreements.

**"The preset has a pattern I genuinely don't need in my repo."**
You can override a specific pattern by name in your config. If you're the
only team that doesn't need it, that's fine. If you're the third team to
override it, raise it centrally — the preset is probably wrong.

**"A new check landed in warn mode and is firing 200 times in my repo."**
That's the system working. Triage in priority order: real violations
first, then exemptions for legitimate cases, then false positives. You
have until the next major to get to zero.

**"An agent (Claude Code, Cursor) keeps making commits that fail
guardrails. Is the agent broken?"**
No, the agent is working. The whole point is to catch agent mistakes at
commit time. Read the finding with the agent — modern agents are fine at
reading the structured error and fixing the issue. If the agent
*repeatedly* fails on the same rule, your AGENTS.md may need a clearer
section on that constraint.

**"The audit log is getting big."**
By design. Rotate it monthly via the script in `docs/audit-rotation.md`
(or — stretch — auto-rotation in a future version). Do not delete entries.

**"We want to add a check that's specific to our team."**
You can add custom regex patterns via `extra_patterns`. For anything more
sophisticated than regex, propose it centrally — the cost of building a
new check well is higher than it looks, and the platform team will help.

**"Someone disabled a check in our config and I don't know why."**
Read the `reason` field. If it's missing or empty, the config is invalid
and the package shouldn't have loaded — file a bug. If the reason is
unclear, ask the original author; if they're unavailable, treat the
override as expired and re-enable the check on a branch to see what
breaks.

---

## 10. Incident recovery — when an agent has eaten your work

This section is the runbook for the scenario that matters most: an agent
has done something destructive and you need to recover.

### 10.1 First, stop

The single biggest determinant of whether work is recoverable is whether
you act before `git gc` runs. Git's garbage collector reclaims
unreferenced objects after roughly two weeks by default, and may run
opportunistically sooner. **Before doing anything else: stop running
commands in the affected repo.** Every Git operation risks pruning the
objects you need.

If the repo is on a developer machine, that's all you need. If the repo
is on a CI runner that auto-cleans, copy `.git/` to a safe location
before continuing.

### 10.2 Identify what was lost

Three categories, each with a different recovery path:

**Lost commits** (force-push, `reset --hard`, branch deletion). The
commit objects still exist in `.git/objects/` until garbage collection.
Recoverable via reflog and direct SHA checkout.

**Lost staged work** (uncommitted but staged changes wiped by `reset --hard` or `checkout`). Staged blobs are stored in `.git/objects/` and
referenced by the index until the next commit; usually recoverable via
`git fsck --lost-found`.

**Lost unstaged work** (working-tree edits never staged or committed).
The hardest case. Git itself has no record of unstaged changes. Recovery
depends on whether `working-tree-guard` was active, whether filesystem
snapshots exist, or whether your editor has a local history feature.

### 10.3 Recovery via `reflog-witness`

`reflog-witness` writes structured forensic data to the configured witness
log, defaulting to `.git/ripstop/witness.jsonl`, on every package
invocation. To use it:

```bash
# Find recent witness entries
ripstop recover --since "1 hour ago"

# Output: a list of HEAD SHAs, branch states, and stash entries
# captured at recent invocations.
```

The output gives you SHAs to check out directly:

```bash
git checkout <sha-from-witness-log>
git switch -c recovery/lost-work
```

If `reflog-witness` was active and recent, this is usually the fastest
path back to known-good state.

### 10.4 Recovery via Git native tools

If `reflog-witness` data is unavailable or insufficient:

```bash
# Show recent HEAD movements — this is the standard reflog
git reflog show HEAD

# Show branch-specific reflog (useful for deleted branches)
git reflog show <branch-name>

# Find dangling commits that aren't in any reflog
git fsck --lost-found

# Find dangling blobs (recovery for staged-but-not-committed work)
git fsck --unreachable | grep blob
```

For each candidate SHA, inspect with `git show <sha>` to verify before
checkout.

### 10.5 Recovery via `working-tree-guard` snapshots

If `working-tree-guard` was active and the agent harness was correctly
wired, snapshots of unstaged work exist in the configured snapshot
directory:

```bash
# List snapshots
ls -la .git/ripstop/snapshots/

# Restore a specific snapshot to a temp directory for inspection
ripstop recover --snapshot .git/ripstop/snapshots/2026-05-06T14-22-31Z/

# Or copy directly back into the working tree (overwrites current state — careful)
ripstop recover --snapshot <path> --apply
```

If `working-tree-guard` was *not* active, this path doesn't exist and
you fall back to filesystem-level recovery (Time Machine, backups,
editor local history).

### 10.6 Recovery via filesystem snapshots

If you have Time Machine (macOS), `btrfs` snapshots, ZFS, or another
filesystem-level snapshot system: this is the most reliable path
because it operates entirely outside Git and outside the agent's reach.
Restore the file or directory from the most recent snapshot before the
destructive event.

If you have none of the above: this is the lesson that gets people to
adopt them. Write it down for the post-incident review.

### 10.7 Recovery via editor local history

VS Code, JetBrains IDEs, and most modern editors keep a local history of
file changes independent of Git. If the file you've lost was open in
your editor recently:

- VS Code: `Timeline` view in the Explorer panel, or
`~/.config/Code/User/History/`
- JetBrains: right-click file → `Local History` → `Show History`
- Vim / Neovim with persistent undo: `:earlier 1h`

Local editor history is per-file, so this only helps for files you were
actively editing.

### 10.8 After recovery — the post-incident steps

Once you've recovered (or accepted the loss), three follow-ups:

1. **Capture what happened in the audit log.** Add a manual entry to
  the configured audit log describing the incident, what was lost,
   what was recovered, and how. This becomes evidence in the next
   quarterly review.
2. **Identify which guardrail would have prevented it.** Was
  `history-guard` mis-configured? Was the agent harness not wired to
   call `working-tree-guard snapshot`? Was the agent running with
   `--no-verify`? Whatever the gap, fix it for next time.
3. **Report it centrally.** Even if the recovery was clean, the
  platform team wants to know. Patterns across teams drive the next
   release. File an incident report via the standard channel.

### 10.9 Things that look recoverable but aren't

Setting honest expectations:

- **Unstaged changes destroyed >2 weeks ago** with no snapshots, no
editor history, no filesystem backup. The objects have been garbage
collected. They're gone.
- **Force-pushed commits older than the remote's reflog retention.**
GitHub keeps reflog ~90 days; self-hosted may be shorter or longer.
Past that window, server-side recovery is impossible.
- **Files deleted via `rm -rf` outside Git.** Git never saw them. Only
filesystem-level snapshots help here.

The lesson, repeated: prevention is cheaper than recovery, and recovery
requires preparation that has to be in place *before* the incident.
That's what `reflog-witness` and `working-tree-guard` are for. Turn
them on.

---

## 11. Escalation

In order:

1. `**#guardrails` channel** — quick questions, peer help.
2. **Office hours** — design issues, advice, not-time-sensitive frustrations.
3. **GitHub issue, P3** — false positives, feature requests, docs.
4. **GitHub issue, P2** — blocking your team, workaround exists.
5. **Platform team lead, direct message** — blocking your team, no
  workaround, time-sensitive.
6. **Eng leadership** — only when (5) hasn't responded within one working
  day on a P1.

Don't skip levels unless it's genuinely urgent. Don't sit on a P1 because
you're unsure it qualifies — if you're unsure, it does.

---

## 12. What "good" looks like

A team that's running this well has these properties:

- `.guardrails.yaml` is short and mostly identical to the preset
- The audit log shows few bypasses and meaningful reasons when they happen
- `mode: off` appears nowhere in the config
- Exemptions have specific, recent, traceable reasons
- New minor versions get triaged within their release cycle, not
accumulated
- Findings on PRs get fixed, not bypassed
- Your AGENTS.md and your `.guardrails.yaml` agree about what matters
- `reflog-witness` is on, and the team has done at least one practice
recovery so the runbook isn't being read for the first time mid-incident

A team that's running this badly — and the platform team will notice — has
the inverse. Don't be that team.

---

## 13. Customising what runs in your repo

The package is opinionated by default but supports tailoring at three
escalating levels of effort. Always start at the lowest level that
solves your problem.

### 13.1 Level 1 — Tune the config

Trivial. Five minutes. No code.

In `.guardrails.yaml`, you can:

- Change `mode` per check (`enforce`, `warn`, `off` — with governance
caveats from §6 for `off`)
- Narrow `triggers` so a check only runs in specific contexts:
  ```yaml
  checks:
    pii:
      triggers: [ci]              # don't run on every commit, just PRs
    dependency-guard:
      triggers: [ci]              # same — heavy check, CI-only
  ```
  You can narrow but not expand the trigger set; each check declares
  which triggers it supports.
- Add `extra_patterns` for repo-local needs (`pii` only)
- Add path or line `exemptions` with a `reason`
- Override individual fields from the inherited preset (different
protected branches, different ticket regex, etc.)
- Pick a different preset entirely

This is the 95% case. Most "I want different behaviour" requests
resolve here without anyone writing code.

### 13.1.5 Level 1.5 — keep `RIPSTOP.md` fresh

If you use `ripstop generate-md` (see §3.2a):

- Regenerate after **every** meaningful `.guardrails.yaml` change.
- Prefer a **small, atomic commit** that only touches config + `RIPSTOP.md`,
  separate from feature work, so reviewers see drift fixes clearly.
- When `ripstop-md-fresh` is enabled, forgetting regeneration **fails the
  hook or CI on purpose** — treat that as a feature, not friction.
- **Do not hand-edit** `RIPSTOP.md`. If the generated text is wrong,
  fix `.guardrails.yaml` (or the generator); the file is derived.

### 13.2 Level 2 — Use a plugin package

Easy if a relevant plugin exists; a day's work to publish one.

If your team has rules used across multiple repos, the right answer is
a plugin package. Add to your config:

```yaml
plugins:
  - "@yourteam/guardrails-checks-billing"

checks:
  billing-currency-format:        # provided by the plugin
    mode: enforce
```

The plugin author publishes an npm package exporting an array of
checks; consumers install and reference. Versioned independently of the
core library.

When to use a plugin over local checks: when the same rule is wanted in
three or more repos. One plugin, many consumers, central versioning.

### 13.3 Level 3 — Write a local check

Half a day for the first one, faster after. TypeScript skill required.

For genuinely repo-specific rules — a pattern that only matters in
this codebase, an architectural constraint that's local to your
domain — drop a check file in `.guardrails/checks/`:

```typescript
// .guardrails/checks/no-direct-db-access.ts
import { z } from "zod";
import type { Check } from "@jonverrier/ripstop";

const config = z.object({
  domain_paths: z.array(z.string()).default(["src/domain/**"]),
  blocked_imports: z.array(z.string()).default(["pg", "mysql2"]),
});

export default {
  name: "no-direct-db-access",
  description: "Domain layer must not import database drivers directly",
  supportedTriggers: ["pre-commit", "ci"],
  configSchema: config,
  async run(ctx) {
    const cfg = config.parse(ctx.config);
    const findings = [];
    for (const file of ctx.files) {
      // ... your check logic
    }
    return findings;
  },
} satisfies Check;
```

Enable in config:

```yaml
local_checks:
  enabled: true
  path: ".guardrails/checks"

checks:
  no-direct-db-access:
    mode: enforce
    domain_paths: ["src/domain/**", "src/policy/**"]
    blocked_imports: ["pg", "mysql2", "sqlite3"]
```

Local checks are reviewed in PR like any other code. The platform team
does not own them; you do.

### 13.4 Stewardship — when to escalate a local check

A local check that proves valuable in your repo often points to a
broader gap. Use this rule:

- **One repo finds it useful** → keep it local.
- **A second repo wants it** → propose making it a plugin.
- **A third repo wants it** → it should probably be in the central
library or a preset.

The platform team's quarterly retrospective is the natural place to
surface useful local checks. A check that has spread to ten repos as
copy-paste local code is a failure of the central library, not a
success of the local-check feature.

### 13.5 What you should *not* override

Some defaults exist for reasons that are not always obvious. Before
overriding these, ask centrally:

- `**reflog-witness` mode.** It's near-zero cost and the data has
saved engagements. `off` requires platform-team sign-off (§6).
- `**history-guard` `protected_branches`.** Removing entries here is
rare and almost always a mistake. If `main` shouldn't be protected
in your repo, something else is wrong.
- **Default `pii` patterns from the preset.** Disabling a default
pattern is fine for a confirmed false positive, but should be
reported centrally first (§4.2).

When in doubt, the rule is: tune locally if it's a fit-to-context
concern, escalate centrally if it's a fit-to-system concern.

---

## 14. Quick reference

```bash
# --- Running checks ---

# Run on staged files (what pre-commit does)
ripstop check --staged --trigger pre-commit

# Run trailer checks against the commit message
ripstop check --staged --trigger commit-msg --commit-msg-file .git/COMMIT_EDITMSG

# Run on whole repo (one-shot triage)
ripstop check --all

# Run on PR diff (what CI does)
ripstop check --diff origin/main --trigger ci

# Run only one check
ripstop check --all --check pii

# --- Inspecting config ---

# List all checks and their current mode and triggers
ripstop list

# See documentation for a specific check
ripstop explain pii

# See merged effective config for a check
ripstop explain pii --resolved

# --- Recovery (when something has gone wrong) ---

# Show witness log entries from the last hour
ripstop recover --since "1 hour ago"

# List all snapshots in retention window
ripstop recover --list

# Inspect a specific snapshot
ripstop recover --snapshot .git/ripstop/snapshots/<timestamp>/

# Restore a snapshot (overwrites working tree — confirms first)
ripstop recover --snapshot <path> --apply

# --- Misc ---

# Capture a working-tree snapshot (usually invoked by agent harness)
ripstop snapshot --reason "before reset"

# Print version (for bug reports)
ripstop version
```

```yaml
# .guardrails.yaml essentials
repo:
  name: <repo-name>
  domain: <bss | oss | network | tooling>
  tier: <1 | 2 | 3>

extends: "@jonverrier/ripstop/presets/<preset>"

plugins:                          # optional
  - "@yourteam/guardrails-checks-<area>"

local_checks:                     # optional
  enabled: true
  path: ".guardrails/checks"

checks:
  <check-name>:
    mode: enforce | warn | off
    triggers: [pre-commit, commit-msg, pre-push, pre-rebase, ci]
    exemptions:
      - path: <glob>
        reason: <required>
    extra_patterns:               # pii only
      - name: <string>
        pattern: <regex>
        message: <string>
```

```
# Bypass commit trailers (use whichever applies)
GUARDRAILS-BYPASS: <rule-id>
GUARDRAILS-BYPASS-REASON: <ticket and reason>

# Or for history-guard specifically:
HISTORY-OVERRIDE: <ticket and reason>

# For path-guard:
CHANGE-APPROVED: <ticket>
```

That's the playbook. The package will not make you a better team on its
own; using it well will.