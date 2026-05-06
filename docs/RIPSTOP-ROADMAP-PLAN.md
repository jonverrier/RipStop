# Ripstop — roadmap and priorities

**Status:** Living document (engineering plan)  
**Audience:** Maintainers and consumers aligning on what exists vs. what comes next  
**Companion:** `agent-guardrails-spec.md` (full behaviour and future checks), `agent-guardrails-consumer-playbook.md` (adoption and recovery)

---

## 1. Purpose

This file records **what `@jonverrier/ripstop` already does**, **what we should do next**, and **how owner priorities map to the backlog**. It is not a substitute for the spec; it is the short prioritised view.

---

## 2. What is shipped and working today (v0.1.x)

These checks are **implemented**, run via `ripstop check`, and are **fully opt-in per repository** through `.guardrails.yaml` (and optional `extends:` presets). Each check supports **`mode: off | warn | enforce`** unless noted.

| Check | Triggers (as wired in code) | What it does |
|--------|----------------------------|----------------|
| **`pii`** | `pre-commit`, `ci` | Regex scan for common PII patterns in selected files; exemptions configurable. |
| **`path-guard`** | `commit-msg`, `ci` | If protected globs changed, requires an approval trailer in the commit message. |
| **`test-skip`** | `pre-commit`, `ci` | Warns/enforces on disallowed test-skip patterns and optional ticket requirement. |
| **`history-guard`** | **`pre-push` only** | On protected branches (glob patterns), blocks **force push** and **remote branch delete** when configured. Uses stdin lines Git passes to `pre-push` (`--remote`, stdin parsing in CLI). |

**Also shipped:** YAML config load + preset merge (`extends: @jonverrier/ripstop/presets/...`), built-in presets (`internal-tooling`, `telco-generic`), CLI (`ripstop` / `agent-guardrails` alias), human + JSON reporting, and **structured audit logging** of findings to the path in `reporting.audit_log` (default `.git/ripstop/audit.jsonl`). A **witness** writer and default `witness_log` path exist in code and config, but **no check yet appends reflog-style witness records** — treat witness as **reserved for `reflog-witness`** until that ships.

**Documented in the spec but not implemented yet** (non-exhaustive): `reflog-witness`, `working-tree-guard`, `dependency-guard`, **`history-guard` on `pre-rebase`** (e.g. rebasing commits that already exist on a remote — still spec-only for that hook), container/binary distribution extras.

---

## 3. Owner priorities (how the backlog is ordered)

### 3.1 Priority A — Git actions that **damage history** (highest)

**Intent:** Reduce the chance of **rewriting or deleting shared history** (force-push, deleting important remote branches, and — when we add it — risky rebases of already-pushed work).

**Today:** `history-guard` covers **force push** and **remote branch deletion** on **configured** protected branch patterns, on **`pre-push`** only.

**Why this is the right tier for “strict” control:** Once bad objects are advertised on a shared remote, recovery is a **coordination and incident** problem, not a solo `reflog` fix. Client hooks **cannot** replace server-side branch protection (GitHub/GitLab rules); Ripstop **complements** them for local/agent mistakes before the push completes.

**Consumer configurability (required and already the model):**

- Turn the check off: `history-guard: { mode: off }`.
- Warn only: `mode: warn`.
- Tune **which branches** count as protected: `protected_branches` (globs, e.g. `main`, `release/*`).
- Toggle behaviours: `block_force_push`, `block_branch_delete_on_remote`.

### 3.2 Priority B — **Less strict** control over **losing unstaged work** (needs a clear story)

**Intent:** Address the failure mode where **nothing was committed** — so **Git has no commit object** for the lost edits — and `reflog` cannot bring them back. That is different from Priority A: here we are not protecting **remote history**, we are protecting **local working tree** content that only ever lived in the editor/filesystem buffer.

**Re-explained in plain language**

| Concern | What Git “knows” | Typical bad commands | What Ripstop can do at **Git hook** time |
|--------|-------------------|----------------------|----------------------------------------|
| **Remote / published history** | Commits reachable from refs; server refs | Force push, delete `origin/main` | **`history-guard` on `pre-push`** — blocks before send (with caveats below). |
| **Unstaged / uncommitted edits** | Often **nothing** durable if never staged | `git checkout -- .`, `git reset --hard`, `git clean -fd`, careless `git stash` without restore, agent overwrite of dirty files | Hooks run **after** the damage in many cases — **too late to block**. Prevention needs **before** the command (harness) or **snapshot** semantics. |

So “less strict control” here should mean:

1. **Not** pretending a `pre-commit` hook can block `git reset --hard` that an agent ran five minutes ago.
2. **Yes** offering a **graded** policy: e.g. **warn** when we detect risk signals we *can* see, **snapshot** (when harness calls Ripstop) before destructive ops, and optionally **block** only in harnesses that support an interactive confirm — all **configurable** (`mode`, `on_destructive_command: snapshot | warn | block`, retention), per repo.

The spec’s **`working-tree-guard`** (§10.7 in `agent-guardrails-spec.md`) describes this honestly: **full prevention requires agent-harness cooperation**; Ripstop can still add **snapshot**, **orphan snapshot warnings** at commit time, and documentation for Cursor/Claude wiring.

**Consumer configurability (required for this track):**

- **`mode: off | warn | enforce`** for the check as a whole.
- Sub-options as in the spec sketch: retention, paths, whether pre-commit surfaces orphaned snapshots, and how aggressive “block” is when we integrate with a harness (repos that cannot integrate should use **warn + snapshot** only).

---

## 4. Configurability principle (both priorities)

Every repo **chooses** its posture via `.guardrails.yaml`:

- **`mode: off`** — check does not run (or runs but cannot fail the hook, depending on runner; today `off` skips enforcement paths in the runner).
- **`mode: warn`** — signal without blocking commits/pushes (good for rollout).
- **`mode: enforce`** — failing exit code when the hook/CI cares.

Presets (`extends:`) are **defaults**, not mandates: consumers override or set checks to `off`. Document any organisation-wide **expectations** in internal governance docs, not inside Ripstop binaries.

---

## 5. Prioritised backlog (what to do next)

Numbers are **order of recommendation**, not time estimates.

1. **`history-guard` — complete the “history damage” story**  
   - Implement **`pre-rebase`** (or equivalent) path described in spec: detect when a rebase would rewrite commits already on a protected remote (needs hook args / merge-base logic as per spec).  
   - Document **pairing with Git host branch protection** (Ripstop is client-side).  
   - Add integration tests and playbook steps for **`.husky/pre-push`** wiring (stdin + `--remote`).

2. **`working-tree-guard` — first minimal vertical slice**  
   - Implement **`ripstop snapshot`** (or named equivalent) that copies dirty/untracked files to a retention-bounded directory under `.guardrails/` or `.git/ripstop/` as decided.  
   - **`ripstop check --trigger pre-commit`**: optional **orphan snapshot** warnings (configurable, default **warn** for less strict posture).  
   - Ship **Cursor / Claude** cookbook snippets that call snapshot **before** wrapped destructive git commands (links from playbook).

3. **`reflog-witness` (spec §10.6)**  
   - Low runtime cost; improves **recovery** after mistakes; complements Priority A (forensics) without being a substitute for server rules.

4. **Preset and docs pass**  
   - Ensure `internal-tooling` / `telco-generic` only **suggest** Priority A+B checks; document “strict history, soft working tree” recipe (`history-guard: enforce`, `working-tree-guard: warn`).  
   - Align this roadmap with the spec matrix where shipped vs. planned diverges.

5. **Distribution hardening**  
   - Standalone binary / CI image track if non-Node consumers need it (spec §5).

6. **Later: `dependency-guard`, SARIF, governance automation**  
   - As demand appears; do not block Items 1–2.

---

## 6. Review cadence

Update this file when a check moves from **planned → shipped**, when owner priorities change, or after each minor release that affects defaults.
