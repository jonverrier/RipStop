# `@jonverrier/ripstop` — Package Specification

**Status:** Draft v0.1
**Owner:** [Consulting firm name]
**Audience:** The two engineers building this. Anyone forking it later.

---

## 1. Purpose

A small, opinionated package that enforces engineering guardrails in repositories
where AI coding agents (Claude Code, Cursor, Codex, Amazon Q) make changes. The
guardrails run as Git hooks and CI steps, independent of which agent — or human —
made the commit.

The package solves three problems:

1. **AGENTS.md and equivalents are advisory.** Agents drift, jailbreaks happen,
  and a different model tomorrow won't read yesterday's prose. We need checks
   that *fail the build* rather than ones that *ask nicely*.
2. **Duplicating guardrail logic across repos rots fast.** Within a quarter,
  every repo's PII regex has diverged. We want one library, many thin shims.
3. **Telco repos are polyglot.** Java, Python, TypeScript, Go all coexist.
  Guardrails must work without forcing a runtime onto every build agent.

---

## 2. Goals & non-goals

### Goals

- One versioned library, consumed identically across all repos.
- Two-line wiring per repo (one hook entry, one config file).
- Cross-language: works in TS, Java, Python, Go repos with no language runtime
beyond what the package itself ships with.
- Cross-agent: every check enforced regardless of which AI tool made the commit.
- Config-driven: new checks can be rolled out as warn-only before enforcing.
- Auditable: every failure produces a structured record suitable for security
review.

### Non-goals

- Static analysis or type checking — that's the existing toolchain's job.
- Runtime defence (sandboxing, network egress control) — that's Layer 3 in the
guardrails model and lives in agent harness configs, not here.
- Replacing existing secret scanners (gitleaks, trufflehog). We invoke them; we
don't reinvent them.
- Policy authoring UI. Config is YAML in the repo, edited by humans.

---

## 3. Personas


| Persona               | What they need from this package                                                   |
| --------------------- | ---------------------------------------------------------------------------------- |
| Repo owner (engineer) | Wire it in once, get sensible defaults, override locally where genuinely needed    |
| Maintainers / champions | Publish defaults and presets; triage **GitHub issues**; ship semver-safe releases (optional internal role when many repos adopt Ripstop) |
| Security / compliance | Evidence that checks ran, what they caught, and an audit trail of bypasses         |
| AI coding agent       | A clear, machine-readable error when it does something the org disallows           |


---

## 4. Architecture overview

```
┌──────────────────────────────────────────────────────────┐
│  Published package: @jonverrier/ripstop                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  CLI entrypoint  (cli.ts)                          │  │
│  │  Config loader   (reads .guardrails.yaml)          │  │
│  │  Check registry  (built-in + presets + local)      │  │
│  │  Reporter        (human / JSON / SARIF)            │  │
│  │  Logs            (audit.jsonl, witness.jsonl)      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                          ▲
                          │ pinned semver / binary version
                          │
┌─────────────────────────┴────────────────────────────────┐
│  Consuming repo                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  .guardrails.yaml         ← policy                 │  │
│  │  .guardrails/checks/      ← optional local checks  │  │
│  │  .husky/pre-commit        ← staged-content shim    │  │
│  │  .husky/commit-msg        ← trailer-policy shim    │  │
│  │  .husky/pre-push          ← shim (history-guard)   │  │
│  │  .husky/pre-rebase        ← shim (history-guard)   │  │
│  │  .github/workflows/ci.yml ← shim                   │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

The library owns mechanism. The repo owns policy. The shims are
one line each. The package is Layer 2 in a three-layer model defined
in §22.4 — it sits between agent-config files (Layer 1) and harness
sandboxing (Layer 3), and is most effective deployed alongside both.

---

## 5. Distribution

The package ships in two forms from the same source tree:

- **npm package** (`@jonverrier/ripstop`) — for TS/JS-native repos.
Pinned in `devDependencies`, invoked via `npx`.
- **Standalone binary** — produced by `bun build --compile`, one binary per
platform (`linux-x64`, `linux-arm64`, `darwin-arm64`, `win-x64`). Published
to the firm's / telco's internal artefact store. For repos that can't or
won't install Node.

A `setup` script in the install docs picks the right form based on the repo's
existing toolchain. The CLI binary is named `ripstop`.

A **container image** (`ghcr.io/jonverrier/ripstop:<version>`) is a
stretch deliverable for environments where neither npm nor binaries are
viable.

### Cross-compilation

All four target binaries are produced from a single host via `bun build --compile --target=<target>`. No per-platform build infrastructure is
required. The release pipeline runs on one CI host and emits binaries for
`linux-x64`, `linux-arm64`, `darwin-arm64`, and `windows-x64`.

### Constraint: pure-JS dependencies only

The package must not depend on any npm module with native bindings (modules
that require `node-gyp` or ship `.node` binaries). Native dependencies do
not cross-compile cleanly and break the single-binary distribution model.
Approved choices for the dependency surface include `js-yaml` for YAML,
`zod` for schema validation, `picomatch` for glob matching, and shelling
out to `git` for diff and staging operations rather than depending on a
native Git binding. PRs introducing native dependencies are rejected.

### Code signing

For **early 0.x** binary distribution, binaries ship **unsigned**. Users will see SmartScreen
warnings on Windows and Gatekeeper quarantine prompts on macOS when
binaries are downloaded via a browser. The install documentation calls
this out explicitly with the workaround steps.

In a **later release**, binaries are targeted to be signed:

- **Windows**: signed under the firm's or the telco's existing code-signing
certificate (Authenticode).
- **macOS**: signed with an Apple Developer ID and notarised via Apple's
notary service, with the notarisation ticket stapled to the binary.

Code signing is **deferred past the first published binaries** because the
certificate procurement and pipeline integration is half a day of work
that doesn't materially change the package's behaviour, only its
adoption friction in browser-download contexts. Internal artefact-store
distribution (the primary path) is unaffected by signing status.

### Versioning policy

- Strict semver.
- **Major bump** for: any new check enabled by default, any change to existing
check semantics that could newly fail a previously-passing repo, any breaking
config schema change.
- **Minor bump** for: new checks shipped disabled-by-default, new config keys
with safe defaults, new presets.
- **Patch bump** for: bug fixes, performance, error message improvements.

This discipline is non-negotiable. A library that breaks thirty repos on a
Tuesday afternoon loses adoption immediately.

---

## 6. Package layout

```
ripstop/
├── src/
│   ├── cli.ts                    # entrypoint
│   ├── config/
│   │   ├── load.ts               # reads .guardrails.yaml + presets + local checks
│   │   └── schema.ts             # zod schema for config validation
│   ├── checks/
│   │   ├── types.ts              # Check interface
│   │   ├── registry.ts           # registers built-in + plugin + local checks
│   │   ├── pii.ts
│   │   ├── path-guard.ts
│   │   ├── test-skip.ts
│   │   ├── dependency-guard.ts
│   │   ├── history-guard.ts      # pre-push, pre-rebase
│   │   ├── reflog-witness.ts     # forensic capture, all triggers
│   │   └── working-tree-guard.ts # snapshot + recover subcommands
│   ├── reporters/
│   │   ├── human.ts              # terminal output
│   │   ├── json.ts               # machine output
│   │   └── sarif.ts              # GitHub security tab integration (stretch)
│   ├── logs/
│   │   ├── audit.ts              # findings, bypasses, exemptions
│   │   └── witness.ts            # reflog snapshots, recovery data
│   ├── git/
│   │   ├── staged.ts             # files in current commit
│   │   ├── diff.ts               # diff utilities
│   │   ├── push.ts               # push payload parsing for history-guard
│   │   └── reflog.ts             # reflog capture for reflog-witness
│   ├── recovery/
│   │   ├── snapshot.ts           # working-tree snapshot writer
│   │   └── restore.ts            # snapshot reader for `recover` subcommand
│   └── presets/
│       ├── telco-generic.yaml
│       ├── telco-bss.yaml        # heavy PII, billing context
│       ├── telco-network.yaml    # IMSI/IMEI, infra paths
│       └── internal-tooling.yaml # minimal, mostly path-guard and test-skip
├── test/
│   ├── unit/
│   ├── fixtures/                 # fake repos for end-to-end testing
│   └── integration/
├── docs/
│   ├── README.md
│   ├── per-agent-config.md       # how each AI agent integrates
│   ├── adding-a-check.md         # for plugin and local check authors
│   └── rollout-playbook.md
├── package.json
├── tsconfig.json
└── build.ts                      # bun build --compile orchestration
```

Two log files in `.guardrails/` of the consuming repo, with distinct
purposes:

- `**audit.jsonl**` — findings, bypasses, exemptions. Read by humans and
reviewers. The compliance trail.
- `**witness.jsonl**` — reflog snapshots, HEAD SHAs, stash inventory.
Read forensically when something has gone wrong. The recovery trail.

Both are append-only by convention; the package never edits or deletes
existing entries.

---

## 7. Configuration schema

`.guardrails.yaml` lives at the repo root. Validated against a zod schema at
load time; invalid configs fail loudly.

```yaml
# Repo identity (used in audit and witness logs)
repo:
  name: bss-billing-service
  domain: bss
  tier: 1                          # 1 | 2 | 3 — see below

# Inherit from a preset; repo config overrides preset values
extends: "@jonverrier/ripstop/presets/telco-bss"

# Optional: load checks from external plugin packages
plugins:
  - "@jonverrier/ripstop-checks-billing"

# Optional: load checks from this repo's own .guardrails/checks/ directory
local_checks:
  enabled: true
  path: ".guardrails/checks"

# Per-check configuration
checks:
  # ---- Foundational checks ----
  pii:
    mode: enforce                  # enforce | warn | off
    triggers: [pre-commit, ci]     # which triggers this check fires on
    extra_patterns:
      - name: internal-account-id
        pattern: '\bACC-\d{8}\b'
        message: "Internal account IDs must not appear in source"
    exemptions:
      - path: "test/fixtures/**"
        reason: "Synthetic test data"

  path-guard:
    mode: enforce
    triggers: [commit-msg, ci]
    protected_paths:
      - "infra/**"
      - "migrations/**"
      - "*.policy.yaml"
    approval_trailer: "CHANGE-APPROVED"

  test-skip:
    mode: warn
    triggers: [pre-commit, ci]
    blocked_annotations: ["@skip", ".skip(", "xit(", "@Disabled"]
    require_ticket: true

  dependency-guard:
    mode: enforce
    triggers: [ci]                 # only on PRs; don't slow down commits
    manifests: ["package.json", "requirements.txt", "pom.xml"]
    require_adr_for_new_deps: true
    adr_path: "docs/adr/"

  # ---- History-protection checks ----
  history-guard:
    mode: enforce
    triggers: [pre-push, pre-rebase]
    protected_branches: [main, master, develop, "release/*"]
    block_force_push: true
    block_branch_delete_on_remote: true
    block_rebase_of_pushed_commits: true

  reflog-witness:
    mode: enforce                  # 'off' is permitted but discouraged
    triggers: [pre-commit, pre-push, pre-rebase]
    reflog_depth: 50

  # ---- Working-tree protection (requires harness cooperation) ----
  working-tree-guard:
    mode: enforce
    triggers: [pre-action, pre-commit]   # pre-action = harness-invoked
    snapshot_path: ".guardrails/snapshots"
    retention_days: 7
    on_destructive_command: snapshot     # snapshot | block | warn
    surface_orphans_in_precommit: true

# Global behaviour
reporting:
  format: human                    # human | json | sarif
  audit_log: ".git/ripstop/audit.jsonl"
  witness_log: ".git/ripstop/witness.jsonl"

# Unified bypass / override mechanism (see §7.2)
bypass:
  allowed: true
  trailer: "GUARDRAILS-BYPASS"
  requires_reason: true
  rule_specific_trailers:
    history-guard: "HISTORY-OVERRIDE"   # legacy / domain-specific alias
```

### 7.1 Repo tier

The optional `repo.tier` field drives **governance language** in this spec
and the consumer playbook (who should sign off on `mode: off`, how hard to
scrutinise bypasses). It is **not validated by Ripstop** — a convention for
teams that want a shared vocabulary. **Single-repo or OSS adopters** may
ignore tiers entirely or set one tier for documentation only.

Illustrative meanings (same as the playbook; adapt or drop for your org):

- **Tier 1** — production, customer-facing or revenue-bearing. Strictest
governance in the playbook: exemptions and `mode: off` expect **named
reviewer sign-off** (your org defines who).
- **Tier 2** — production, internal-facing or supporting. Standard
governance.
- **Tier 3** — non-production. Sandboxes, experiments. Lighter governance;
the consumer obligations below are still good practice but not every team
will enforce them the same way.

**Misclassification** (wrong tier for the data class) is an **organisational**
risk — not something Ripstop fails in CI. Large programmes may review tier
choices periodically; a solo maintainer picks one tier and moves on.

### 7.2 Bypass and override — unified model

Two trailers exist for historical and domain-specific reasons, but they
are the same mechanism with different prefixes:

- `GUARDRAILS-BYPASS: <rule-id>` — the general-purpose bypass, applies
to any check.
- `HISTORY-OVERRIDE: <reason>` — equivalent to
`GUARDRAILS-BYPASS: history-guard`, kept as an alias because
history-rewriting operations are conceptually distinct enough that
reviewers want to spot them at a glance.

Both produce identical audit log entries (`type: bypass`, `rule: <rule-id>`). The consumer playbook §5 documents both with the same
governance and review cadence. New rule-specific aliases require
**upstream maintainer / org governance** approval before landing in the
defaults; ad-hoc proliferation defeats the point.

### 7.3 Key behaviours

- `**extends`** loads a preset from the package itself; repo config is
merged shallow-over-deep, with arrays replaced rather than concatenated
(predictable).
- `**plugins`** loads additional checks from external packages. Each
plugin must export checks conforming to the §9 `Check` interface.
Plugins are loaded after presets and before local checks.
- `**local_checks**` discovers check implementations in the consuming
repo. See §9.1 for the discovery contract.
- `**mode**` has three values. `off` skips the check entirely; `warn`
runs it and reports findings but exits 0; `enforce` exits non-zero on
any finding.
- `**triggers**` narrows when a check runs. Each check declares the set
of triggers it supports; consumers can narrow to a subset but not
expand. Valid triggers: `pre-commit`, `commit-msg`, `pre-push`,
`pre-rebase`, `pre-action` (harness-invoked), `ci`. Trailer-based
checks run in `commit-msg`; `pre-commit` does not have access to the
final commit message.
- `**exemptions**` are explicit, scoped, and require a `reason`. They
are logged in the audit trail.
- `**bypass**` allows a developer to commit despite a failure by
including the trailer in the commit message. Always logged. Repos can
disable this entirely.

---

## 8. CLI interface

```
ripstop check [options]

  Run configured checks against the repo.

Options:
  --staged              Run against files staged for commit (pre-commit mode)
  --all                 Run against entire repo (CI mode)
  --diff <ref>          Run against files changed since <ref> (PR CI mode)
  --trigger <name>      Override trigger context: pre-commit | commit-msg |
                        pre-push | pre-rebase | pre-action | ci. Determines which
                        checks fire based on their `triggers` config.
  --check <name>        Run only the named check (repeatable)
  --mode <mode>         Override mode: enforce | warn | off
  --format <format>     Output format: human | json | sarif
  --config <path>       Config file path (default: .guardrails.yaml)
  --bypass-allowed      Honour bypass trailers (default: per config)

ripstop snapshot [options]

  Capture working-tree state to a recoverable snapshot. Invoked by an
  agent harness before destructive Git operations. Writes to
  .guardrails/snapshots/<timestamp>/ and emits the path to stdout.

Options:
  --reason <string>     Logged with the snapshot for forensic context
  --quiet               Suppress stdout output (path goes to log only)

ripstop recover [options]

  Inspect or restore from prior snapshots and witness data. Read-only by
  default; --apply is required to modify the working tree.

Options:
  --since <expr>        Show witness entries since <expr>: "1 hour ago",
                        ISO timestamp, or commit SHA
  --snapshot <path>     Inspect a specific snapshot directory
  --apply               Restore the snapshot to the working tree
                        (overwrites current state — confirms first)
  --list                List all snapshots in retention window

ripstop list

  Lists all available checks (built-in + plugins + local) and their
  current mode and triggers in this repo.

ripstop explain <check> [options]

  Prints documentation for a check, including its config keys and
  rationale.

Options:
  --resolved            Print the merged effective config for this check
                        (preset + plugin + local overrides applied)

ripstop version

  Prints version. Used by audit and witness logs.
```

Exit codes:

- `0` — all enforced checks passed
- `1` — one or more enforced checks failed
- `2` — config error
- `3` — internal error
- `4` — recovery operation refused (e.g. `recover --apply` without
confirmation in a non-interactive context)

---

## 9. Check interface

Every check implements this interface. New checks follow the same pattern,
which keeps the library forkable and the contribution path obvious.

```typescript
// src/checks/types.ts

export type Trigger =
  | "pre-commit"
  | "commit-msg"
  | "pre-push"
  | "pre-rebase"
  | "pre-action"   // harness-invoked, e.g. before destructive commands
  | "ci";

export interface CheckContext {
  repoRoot: string;
  trigger: Trigger;             // which trigger fired this run
  files: FileEntry[];           // staged, all, or diff — depending on mode
  commitMessage?: string;       // present in commit-msg and PR contexts
  pushPayload?: PushPayload;    // present in pre-push only
  config: unknown;              // check-specific, validated by check itself
  mode: "enforce" | "warn" | "off";
  audit: AuditWriter;           // append-only writer for audit log
  witness: WitnessWriter;       // append-only writer for witness log
}

export interface PushPayload {
  refs: Array<{
    localRef: string;
    localSha: string;
    remoteRef: string;
    remoteSha: string;
    isForceUpdate: boolean;
    isDelete: boolean;
  }>;
  remote: string;
}

export interface FileEntry {
  path: string;
  content: () => Promise<string>;   // lazy — avoid loading large files
  diff?: () => Promise<string>;     // present in diff mode
  isNew: boolean;
  isDeleted: boolean;
}

export interface Finding {
  check: string;
  severity: "error" | "warning";
  file?: string;
  line?: number;
  message: string;
  ruleId: string;               // stable identifier for suppression
  context?: Record<string, unknown>;
}

export interface Check {
  name: string;
  description: string;
  supportedTriggers: Trigger[]; // narrows where this check can run
  configSchema: z.ZodSchema;    // each check validates its own config
  run(ctx: CheckContext): Promise<Finding[]>;
}
```

Design notes:

- `content` is lazy because some checks (path-guard) only need the path.
- `Finding.ruleId` is stable across versions so audit logs are diffable.
- Checks return findings; the runner decides whether to fail based on
`mode`. This lets us implement `--mode warn` without each check
re-implementing it.
- `supportedTriggers` is the contract a check declares about where it
can fire; consumer config narrows but cannot expand this set.
- `audit` and `witness` are passed in so checks never need to know the
log file paths directly.

### 9.1 Local checks and plugins

Beyond the built-in checks, the package supports two extension paths
for repo-specific or org-specific rules.

**Local checks** live inside the consuming repo at
`.guardrails/checks/*.ts` (or `.js`). They are discovered automatically
when `local_checks.enabled: true` in the repo config. Each file must
default-export a value satisfying the `Check` interface above. Local
checks are loaded after presets and after plugins, so they can override
plugin checks of the same name (with a warning logged). Local TypeScript
checks and npm plugin packages require a Node-compatible runtime; consumers
using only the standalone binary get built-in checks and YAML config unless
they also install a Node runtime for extensions.

Example:

```typescript
// .guardrails/checks/no-direct-db-access.ts
import { z } from "zod";
import type { Check } from "@jonverrier/ripstop";

const config = z.object({
  domain_paths: z.array(z.string()).default(["src/domain/**"]),
  blocked_imports: z.array(z.string()).default(["pg", "mysql2", "sqlite3"]),
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
      // ... regex or AST check against cfg.blocked_imports
    }
    return findings;
  },
} satisfies Check;
```

**Plugin packages** are npm packages (or binary plugins via a future
extension point — out of scope for the **initial 0.x** surface) that export one or more
checks. Listed in repo config under `plugins:`, loaded after presets
and before local checks. Plugins enable shared check libraries across
repos without each repo copying the implementation.

```yaml
plugins:
  - "@jonverrier/ripstop-checks-billing"
  - "@jonverrier/ripstop-checks-frontend"
```

A plugin package's entrypoint exports an array of `Check`
implementations:

```typescript
// @jonverrier/ripstop-checks-billing/src/index.ts
import currencyFormat from "./checks/currency-format";
import vatRate from "./checks/vat-rate";
export const checks = [currencyFormat, vatRate];
```

**Discovery and validation:**

- Local checks failing to load (syntax error, missing default export,
not satisfying the `Check` interface) cause a config error (exit 2).
Silent skip would hide bugs.
- Plugin checks similarly cause exit 2 if the plugin export is malformed.
- Name collisions across built-ins, plugins, and local checks resolve
in the order: built-ins → plugins → local. A local check named `pii`
would override the built-in. The CLI logs a warning when this
happens; it is not an error, because override is sometimes
intentional.

**Stewardship advice:** local checks earn their keep when a rule is
genuinely repo-specific and unlikely to be useful elsewhere. If a check
is useful in three or more repos, propose it as a plugin or as an
addition to a preset. Local checks that have proliferated to many repos
are a signal of central-library debt.

---

## 10. Initial check set

### 10.1 `pii`

Detects PII patterns in source files outside declared exemption paths.

**Mechanism:** Regex pass over file contents. Default pattern set in the
preset; repos can add to it. Patterns have names so findings are
attributable to specific rules.

**Default patterns** (in `telco-generic` preset):

- MSISDN-shaped: `\b(?:\+?44|0)7\d{9}\b` and international variants
- IMSI: `\b\d{14,15}\b` near keywords like `imsi`, `subscriber`
- ICCID: `\b89\d{17,19}\b`
- Email: standard RFC-ish pattern
- UK postcode: standard pattern

**Config:**

```yaml
pii:
  mode: enforce
  extra_patterns:
    - name: <string>
      pattern: <regex>
      message: <string>
  exemptions:
    - path: <glob>
      reason: <string>
```

**Output example:**

```
✗ pii [error] src/handlers/customer.ts:42
    Match: pattern "msisdn" — found "+447700900123"
    PII must not appear in source. Use fixtures/synthetic.ts.
    rule: pii.msisdn
```

### 10.2 `path-guard`

Fails if protected paths are modified without an approval trailer in the
commit message.

**Mechanism:** Compares the staged file list against `protected_paths` globs
from the `commit-msg` hook. If any match, scans `commitMessage` for the
configured trailer. This deliberately runs in `commit-msg`, not `pre-commit`,
because Git has not created the commit message when `pre-commit` fires.

**Rationale:** `infra/`, `migrations/`, and `*.policy.yaml` are change-controlled.
An agent should not silently mutate them; a human must explicitly attest by
adding `CHANGE-APPROVED: <ticket>` to the commit.

**Config:**

```yaml
path-guard:
  mode: enforce
  triggers: [commit-msg, ci]
  protected_paths: [<glob>...]
  approval_trailer: <string>     # default: "CHANGE-APPROVED"
```

### 10.3 `test-skip`

Fails if the diff introduces new test-skip annotations without a linked ticket.

**Mechanism:** Operates on diffs only. Searches added lines (`+` lines) for
configured annotation patterns. If `require_ticket: true`, also requires a
ticket reference in the same line or the line above.

**Rationale:** "Skip the failing test to make CI green" is the most common
agentic failure mode. Catching new skips at commit time is cheap and the
signal is unambiguous.

**Config:**

```yaml
test-skip:
  mode: warn
  blocked_annotations: [<string>...]
  require_ticket: <bool>
  ticket_pattern: <regex>          # default: '\b[A-Z]+-\d+\b'
```

### 10.4 `dependency-guard`

Fails if a dependency manifest gains a new top-level entry without an ADR
file in the same commit.

**Mechanism:** Diff-based. For each configured manifest, parses old and new
to extract top-level dependency lists, computes the set difference. If new
deps are present and no file under `adr_path` is in the diff, fail.

**Rationale:** New runtime dependencies have supply-chain, licence, and
maintenance implications. They should not be added invisibly by an agent.

**Config:**

```yaml
dependency-guard:
  mode: enforce
  manifests: [<path>...]
  require_adr_for_new_deps: <bool>
  adr_path: <path>
```

### 10.5 `history-guard`

Blocks destructive Git history operations on protected branches.

**Mechanism:** Wires into `pre-push` and `pre-rebase` hooks (not pre-commit).
On `pre-push`: inspects the push payload for force-pushes (`+refs/...`),
non-fast-forward updates, and branch deletions targeting protected branches.
On `pre-rebase`: blocks rebases of branches whose commits have already been
pushed to the configured upstream. Honours the `allow_with_trailer` escape
hatch when present in the most recent commit message.

**Rationale:** Force-pushes, hard resets pushed to remote, and rebases of
shared branches are the highest-impact destructive operations an agent can
perform. They rewrite history that other agents and humans depend on, and
recovery is sometimes impossible. Native Git fires hooks for all of these,
which makes them genuinely enforceable on the client side. Server-side
`pre-receive` enforcement is stronger but out of scope for this package
(it lives on the Git server, not the repo).

**Config:**

```yaml
history-guard:
  mode: enforce
  protected_branches:
    - main
    - master
    - develop
    - "release/*"
  block_force_push: true
  block_branch_delete_on_remote: true
  block_rebase_of_pushed_commits: true
  allow_with_trailer: "HISTORY-OVERRIDE"
```

**Output example:**

```
✗ history-guard [error] push refused
    Force-push to protected branch "main" rejected.
    Force-pushes rewrite shared history. If this is genuinely needed,
    add "HISTORY-OVERRIDE: <reason>" to the commit message.
    rule: history-guard.force-push
```

**Limitations:** Client-side hooks can be bypassed with `--no-verify`. The
audit log records every invocation so bypasses are visible after the fact.
For absolute prevention, pair with server-side branch protection rules in
GitHub / GitLab / Bitbucket.

### 10.6 `reflog-witness`

Captures Git reflog state on every package invocation, providing forensic
recovery data when destructive operations slip through.

**Mechanism:** Not a check in the failure-producing sense — it never fails
the run. Appends a structured entry to the audit log on every invocation
containing: current `HEAD` SHA, branch name, reflog of the last N entries
for `HEAD` and the current branch, list of stash entries, list of recent
loose objects from `.git/objects`. Output is append-only and never prunes.

**Rationale:** Even with `history-guard` in place, things go wrong. An
agent uses `--no-verify`. A developer runs a destructive command outside
the package's view. A repo gets corrupted. When that happens, the
difference between "we lost a day of work" and "we lost a week of work"
is whether someone captured the SHAs *before* `git gc` reclaimed the
unreferenced objects. This check is that capture.

**Config:**

```yaml
reflog-witness:
  mode: enforce             # 'off' is permitted but discouraged
  capture_on: [pre-commit, pre-push, pre-rebase]
  reflog_depth: 50          # number of reflog entries to capture
  audit_log_path: ".git/ripstop/witness.jsonl"
```

**Recovery workflow:** When work is lost, `ripstop recover --since <timestamp>` reads the witness log and prints the SHAs of HEAD
and any stashes that existed at recent invocations. The user then uses
standard Git recovery (`git fsck --lost-found`, `git reflog`,
`git checkout <sha>`) to retrieve the work. Documented in the consumer
playbook's incident-recovery section.

This check has near-zero runtime cost and is the highest-value-per-byte
addition to the package. It should be on by default in all presets.

### 10.7 `working-tree-guard`

Protects unstaged and uncommitted changes from being destroyed by agent
actions.

**Mechanism:** Two modes, both required for full coverage.

*Pre-action mode* (invoked explicitly by an agent harness):
`ripstop snapshot` is called by the agent's tool-use harness
before any operation that could destroy working-tree state — `git checkout`, `git reset --hard`, `git stash` without explicit restore intent,
`git clean`, or any file-write that would overwrite a dirty file. The
command creates `.guardrails/snapshots/<timestamp>/` containing copies of
all dirty files (modified and untracked) and emits the snapshot path to
stdout. The agent's harness logs this path. Snapshots are append-only and
pruned by `retention_days`.

*Pre-commit mode*: detects orphaned snapshots — entries in
`.guardrails/snapshots/` newer than the most recent commit that are not
referenced by any commit message in the recent history. Surfaces them as
warnings on the next commit, prompting the developer to verify nothing is
missing before proceeding.

**Rationale:** The most painful agent failure mode in practice is
silently destroying unstaged work — the developer's mid-flight edits, or
another agent's parallel changes — and then committing something else on
top, making recovery via reflog impossible because the lost state was
never committed in the first place. Pre-commit hooks fire too late to
prevent this; the destructive action has already happened. The only
prevention is to snapshot *before* the action, which requires
cooperation from the agent harness.

**Honest limitation:** This check only protects against agents that have
been configured to call `ripstop snapshot` before destructive
actions. An agent operating purely through shell access and ignoring the
harness wrapper defeats it. The `docs/per-agent-config.md` document
specifies the wiring for each supported agent (Claude Code permissions
hooks, Cursor rules, etc.). For absolute protection, pair with
filesystem-level snapshotting (Time Machine, `btrfs` snapshots, or an
`fswatch`-driven backup script) which operates outside the agent's
reach entirely.

**Config:**

```yaml
working-tree-guard:
  mode: enforce
  snapshot_path: ".guardrails/snapshots"
  retention_days: 7
  on_destructive_command: snapshot   # snapshot | block | warn
  surface_orphans_in_precommit: true
```

**Output example (pre-action snapshot):**

```
ℹ working-tree-guard [info] snapshot created
    Path: .guardrails/snapshots/2026-05-06T14-22-31Z/
    Files: 3 modified, 1 untracked
    Recovery: ripstop recover --snapshot <path>
```

**Output example (orphaned snapshot warning at commit time):**

```
⚠ working-tree-guard [warning] orphaned snapshot
    Snapshot from 2026-05-06T14:22:31Z (12 minutes ago) contains 3
    modified files not referenced by any commit. If you intended to
    discard this work, run: ripstop snapshot prune <path>
    rule: working-tree-guard.orphan
```

---

## 11. Presets

Presets are YAML files shipped inside the package, referenced via
`extends:` in repo configs. They are versioned with the package.

**Built-in presets (shipped in package; evolve with semver):**

- `telco-generic` — sensible defaults, light PII, no domain-specific patterns
- `telco-bss` — extends `telco-generic` with stricter defaults (e.g. `ripstop-md-fresh`); add billing-specific PII patterns in repo overrides as needed
- `telco-network` — extends `telco-generic` with stricter defaults; add IMSI/IMEI/ICCID patterns in repo overrides as needed
- `internal-tooling` — minimal, mostly path-guard and test-skip

### 11.1 Preset check matrix

Default modes per preset. Consumers can narrow but the defaults set the
baseline expectation.


| Check                | telco-generic | telco-bss | telco-network | internal-tooling |
| -------------------- | ------------- | --------- | ------------- | ---------------- |
| `pii`                | warn          | enforce   | enforce       | off              |
| `path-guard`         | enforce       | enforce   | enforce       | enforce          |
| `test-skip`          | warn          | warn      | warn          | warn             |
| `dependency-guard`   | enforce       | enforce   | enforce       | warn             |
| `history-guard`      | enforce       | enforce   | enforce       | enforce          |
| `reflog-witness`     | enforce       | enforce   | enforce       | enforce          |
| `working-tree-guard` | warn          | enforce   | enforce       | warn             |
| `ripstop-md-fresh`   | warn          | enforce   | enforce       | warn             |


`reflog-witness` is `enforce` everywhere because the cost is near-zero
and the value is forensic. `history-guard` is `enforce` everywhere
because client-side enforcement of force-push and rebase rules has no
downside for legitimate workflows. `pii` defaults vary by context —
heavy enforcement where customer data is involved, off in repos that
have no plausible PII surface.

### 11.2 Effective config and resolution

A repo's effective config is `preset ⊕ plugins ⊕ local ⊕ repo overrides`, applied in that order. The CLI's `ripstop explain <check> --resolved` prints the merged config for any single check so
devs can see exactly what's in effect, including which layer
contributed which value.

---

## 12. Reporting and logs

### 12.1 Reporters

Three reporters, selected via config or `--format`:

- `**human`** (default) — coloured terminal output, grouped by file,
with rule IDs and remediation hints. Designed for the developer at
the keyboard.
- `**json`** — one JSON object on stdout: `{ findings: [...], summary: {...} }`. Designed for CI integration and downstream
tooling.
- `**sarif**` — SARIF 2.1.0 output, suitable for GitHub Code Scanning.
Stretch for **early releases**; nice-to-have for security tooling uptake.

### 12.2 Log files

Two distinct log files default under `.git/ripstop/`, with separate
purposes. Keeping runtime logs under `.git/` prevents ordinary hook
invocations from dirtying the working tree. Both append-only by convention;
the package never edits or deletes existing entries. Both paths configurable,
but repos that choose a working-tree path must add the runtime directory to
`.gitignore`.

`**audit.jsonl**` — the compliance trail. Findings, bypasses,
exemption uses, mode changes. One JSON object per relevant event.
Read by humans, reviewers, and security or audit workflows **you** define.
Schema includes: timestamp, version, repo, trigger, check, ruleId,
severity, file, line, type (`finding | bypass | exemption | mode-change`),
author, commit, reason (where applicable).

`**witness.jsonl**` — the forensic recovery trail. Reflog snapshots,
HEAD SHAs, branch states, stash inventory, snapshot directory
references. Written by `reflog-witness` on every invocation it's
configured for. Read forensically by `ripstop recover` and
during incident response. Schema includes: timestamp, version, headSha,
branch, reflog (last N entries), stashes, snapshots, knownRefs.

A typical run appends to both: a finding goes to `audit.jsonl`; the
reflog snapshot taken alongside goes to `witness.jsonl`. Splitting them
keeps the audit log human-readable and the witness log machine-readable
without either fighting the other's format.

Rotation is the consumer's responsibility; recommended monthly, never
delete. The consumer playbook documents the rotation script.

---

## 13. Failure modes & error handling

- **Config invalid** → exit 2 with a clear message pointing at the offending key.
- **Preset not found** → exit 2 with available preset list.
- **Regex compile error in `extra_patterns`** → exit 2 at config-load time,
not mid-run.
- **Check throws unexpectedly** → caught at the runner level, reported as an
internal error, exit 3. One broken check does not skip the others.
- **No staged files** (`--staged` mode) → exit 0 silently.
- **Git not available / not in a repo** → exit 2 with diagnostic.

Error messages always name the rule, the file, and the line. Agent-readable
output is non-negotiable: when an agent's commit fails, the agent must be
able to read the failure and fix it without a human translator.

---

## 14. Security considerations

- The package never reads files outside `repoRoot`.
- Regex patterns from config are screened before use and the default
pattern set avoids nested quantifiers known to cause catastrophic
backtracking. JavaScript `RegExp` has no native timeout; stronger isolation
requires a worker/process boundary and is a future hardening item.
- Both `audit.jsonl` and `witness.jsonl` are append-only by convention;
the package never edits or deletes existing entries. Truncation,
deletion, or out-of-band modification is detectable via line counts
and may be surfaced by **integrity monitoring** or periodic review **your
organisation** runs (Ripstop does not ship cross-repo aggregation).
- Bypass usage is always logged with reason, regardless of config.
- No network calls in the default check set. (Stretch checks that hit
external services — e.g. licence lookup — must be opt-in and
documented.)
- **Local checks and plugins execute arbitrary TypeScript at load
time.** A malicious local check could, in principle, do anything the
package process can do (read files, make network calls, etc.). The
consumer is trusting their own check authors and their plugin
vendors, exactly as they trust their own dev dependencies. The
package does not sandbox check execution; this would be substantial
work for limited benefit, since the consumer already runs the
package's own code unsandboxed. The mitigation is supply-chain
hygiene: pin plugin versions, review local checks in PR, treat
plugin updates with the same care as any dev-dep update.
- The package itself is not a security boundary. Layer 3 (agent harness
permissions, IAM, sandbox) is. This package is a tripwire, not a wall.
See §22.4 for the full layered model.

---

## 15. Testing approach

- **Unit tests** per check, against synthetic file inputs. Aim for branch
coverage on the regex and diff logic.
- **Integration tests** spin up real Git repos in `test/fixtures/`, make
commits, and assert the CLI's exit code and output. Each check has at
least one happy-path and one failing fixture.
- **Snapshot tests** on reporter output (human, JSON, SARIF) so format
regressions are caught.
- **No-Node end-to-end test** runs the bun-compiled binary against a
fixture repo in an environment with Node explicitly absent from `PATH`,
confirming the binary distribution has no hidden Node runtime
dependency. This is the test that catches "we accidentally relied on a
Node-only API" at release time rather than three weeks later when the
first Java repo tries to install. **Required before each release.**

### Platform coverage

The package targets four platforms; testing strategy per platform:


| Platform       | Local dev testing                                                                                     | CI testing                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `darwin-arm64` | Native on developer macOS machines                                                                    | macOS runner on tagged releases                                                         |
| `windows-x64`  | Native on developer Windows machines                                                                  | Windows runner on tagged releases                                                       |
| `linux-x64`    | WSL2 on developer Windows machines, against repos cloned inside the WSL filesystem (not `/mnt/c/...`) | Ubuntu runner on every PR                                                               |
| `linux-arm64`  | No local testing path on x64/arm-mac developer hardware                                               | **Required CI job** on `ubuntu-22.04-arm` runner; no release ships without this passing |


WSL2 is acceptable for `linux-x64` development testing because it runs a
real Linux kernel and behaves identically to native Linux for the package's
operations (file I/O, regex, Git invocation, exit codes). The one
constraint: tests must run against repos inside the WSL filesystem, not
Windows-mounted paths, to avoid case-sensitivity and performance
artefacts that don't reflect production CI.

`linux-arm64` is the platform with no local developer testing path on
typical hardware. Coverage gap is closed by a mandatory CI job; the
acceptance criteria in §19 makes this explicit.

CI runs unit + integration + linux-x64 + linux-arm64 e2e on every PR;
windows and macOS runners run on tagged releases only (cost optimisation).

---

## 16. Build & release pipeline

- **CI:** lint → typecheck → unit → integration → snapshot → linux-x64 e2e
→ linux-arm64 e2e
- **Release:** triggered by tag matching `v*.*.*`. Cross-compiles all four
binaries via `bun build --compile --target=<target>` from a single
Ubuntu runner, runs no-Node e2e against each, generates SHA-256
checksums, publishes to npm, uploads binaries + checksums to internal
artefact store, builds container image (stretch), generates changelog
from conventional commits.
- **Pre-release:** every merge to `main` publishes a `0.0.0-<sha>` package
for internal testing.

The release runner does not need to be platform-matched to the binaries it
produces — Bun cross-compiles. A single Ubuntu runner emits all four.

---

## 17. Adoption playbook

A short, separate doc; summarised here:

1. **Pilot repo** — pick one repo with an engaged owner. Install in `warn`
  mode for all checks. Run for a week. Tune patterns and exemptions.
2. **Flip to `enforce`** on the pilot. Confirm the developer experience.
3. **Roll out to peer repos** in `warn` mode. Use the audit logs to identify
  the most common findings; clean those up before flipping.
4. **Org-wide or fleet-wide `enforce`** for the original check set — *if*
you run many repos; otherwise your single repo is “wide” enough.
5. **New checks** ship in subsequent minor releases, always `warn` first.

Rollout pace, not check coverage, is the variable that determines adoption.
Three checks fully enforced beat ten checks half-adopted.

---

## 18. Out of scope (initial 0.x product scope)

- IDE integration. (Linters already handle in-editor feedback; we're at the
commit boundary deliberately.)
- A web dashboard for findings. Audit logs go to standard tooling.
- Auto-fix. Some findings are auto-fixable in principle (redact a regex
match), but the policy implications are subtle. Defer.
- Cross-repo aggregation. The audit log is per-repo for now; fleet-wide
aggregation is **out of product scope** — build it with your own tooling
if you need it.

---

## 19. Acceptance criteria (initial 0.x product scope)

The package ships when:

1. The four foundational checks (pii, path-guard, test-skip,
  dependency-guard) work against the integration test fixtures.
2. The two history-protection checks (history-guard, reflog-witness) work
  against the integration test fixtures, including pre-push and
   pre-rebase hook integration.
3. The CLI runs in `--staged`, `--all`, and `--diff` modes, plus the
  `snapshot` and `recover` subcommands required by working-tree-guard.
4. Both npm and bun-compiled binary distributions are published.
5. Binaries exist for all four targets: `linux-x64`, `linux-arm64`,
  `darwin-arm64`, `windows-x64`.
6. The no-Node e2e test passes against the `linux-x64` and `linux-arm64`
  binaries in CI.
7. `linux-x64` is verified locally via WSL2 by at least one developer
  before release.
8. `telco-generic` and `telco-bss` presets are complete and exercised in
  tests.
9. One real pilot repo has it installed in `warn` mode and is producing
  audit and witness logs.
10. `docs/per-agent-config.md` covers Claude Code, Cursor, Codex, and
  Amazon Q, including the working-tree-guard wiring for each.
11. `ripstop explain --resolved` produces correct merged config.
12. The README's quick-start works on a fresh machine in under five
  minutes.
13. The install documentation explicitly notes the unsigned-binary
  warnings on Windows and macOS, with workaround steps.
14. §22 — *What the package can and cannot prevent* — is reviewed and
  accepted by the engaging client's security stakeholder before
    release. This avoids the package being mis-sold internally.

`working-tree-guard` may ship in **0.3+** depending on time
remaining; if cut from the initial milestone, it ships behind a `preview: true` flag in
the next minor. `history-guard` and `reflog-witness` are required for the
**first public 0.x** cut described in §19.

---

## 20. Effort estimate

For two AI-augmented engineers over four working days:

- **Day 1:** scaffold, config loader, CLI skeleton, check interface, two
checks end-to-end (`pii`, `path-guard`). Reflog-witness implemented
alongside the audit log infrastructure since they share plumbing.
- **Day 2:** remaining foundational checks (`test-skip`,
`dependency-guard`), `history-guard` with pre-push and pre-rebase hook
integration, presets, reporters (human + JSON).
- **Day 3:** bun-compiled binaries, npm publish dry-run, integration
tests including the no-Node e2e, per-agent docs.
- **Day 4:** install in a **pilot repo**, tune patterns, gather first
audit and witness logs, polish docs, demo. Working-tree-guard
prototype if time remains; otherwise scoped to a **later minor**.

SARIF reporter, container image, `--explain --resolved`, and
working-tree-guard are stretch. Cut them before cutting test coverage,
binary distribution, or the history-protection checks.

The expanded check set adds roughly half a day of net work over the
original four-check scope. `reflog-witness` is genuinely cheap (it's
mostly a structured logger). `history-guard` is the new substantial
piece — pre-push hook integration is well-trodden ground but the
push-payload parsing has edge cases worth testing thoroughly.

---

## 21. Consumer contract

Ripstop is **open source** (`@jonverrier/ripstop` on GitHub). There is **no
vendor relationship** and **no guaranteed response time** on issues — only
shared expectations so adopters and maintainers do not talk past each other.

This section is the **normative** summary. The **consumer playbook**
(`ripstop-consumer-playbook.md`) is the **operational** guide (hooks, triage,
GitHub workflow). Where they differ on tone, the playbook wins for “how to
run it day to day”; this section states the **intent** both sides rely on.

### 21.1 Obligations on consuming teams (good faith)

A team that **pins and runs** `ripstop` is expected to:

1. **Respond to warn-only findings within one release cycle.** Checks that
   ship in `warn` mode may flip to `enforce` in a **future major**.
   Accumulating ignored warnings is how CI breaks on upgrade.
2. **Provide a `reason` on every exemption and override.** Specific,
   traceable, dated where relevant. Empty or boilerplate reasons (`"legacy"`,
   `"TODO"`) defeat the audit trail; the package may tighten validation over
   time.
3. **Use bypass for incidents, not disagreements.** A bypass is a logged
   admission that a finding is correct but the commit must land anyway.
   Repeated bypasses on the same rule are a signal to **fix the cause** or
   **open an upstream GitHub issue** if the rule is wrong for everyone — not
   to normalise bypasses.
4. **Pin the package version explicitly.** Auto-merge on **major** Ripstop
   bumps without review is a foot-gun. Treat upgrades like any other
   dependency with enforcement semantics.
5. **Report false positives upstream before silencing them alone.** Local
   exemptions as a **stop-gap** are fine **with a link to a GitHub issue** on
   the Ripstop repo (or your fork’s tracker if you fork presets). That link is
   how future readers know it is temporary and contested.
6. **Do not edit the audit log.** Append-only by convention; tampering
   breaks trust in incident review.
7. **Keep config proportionate.** If `.guardrails.yaml` is mostly overrides
   and little preset, treat that as **technical debt** — consolidate, fork a
   preset, or document why the drift is permanent. No central team enforces
   this; it is hygiene for your own reviewers.

### 21.2 Obligations on maintainers (upstream, best effort)

The people publishing `@jonverrier/ripstop` aim to:

1. **Triage GitHub issues in good faith** — without SLA promises (see
   consumer playbook §4.5). Security-sensitive reports use **GitHub Security
   Advisories** when enabled.
2. **Ship new checks in `warn` mode by default** where the semver policy
   requires it, so a **minor** release does not newly fail repos that were
   clean at the previous minor.
3. **Document migration steps in major release notes** when behaviour or
   config schema changes in breaking ways.
4. **Publish source and tags** so consumers can bisect, fork, and pin.
5. **Respect the consumer’s right to override** in scoped, justified cases —
   the defaults are opinionated, not a mandate to run every check in
   `enforce` everywhere.

Office hours, fleet dashboards, and “estate-wide” governance are **optional
organisational layers** on top — not part of the OSS default.

### 21.3 What “out of contract” means (and what it does *not* mean)

“Out of contract” here means **not meeting the good-faith obligations in
§21.1** — for example:

- `mode: off` on a check **without** the reviewer discipline your org agreed
  to (see playbook §6 when you use tiers)
- Exemptions without a real `reason`
- Missing, deleted, or suppressed audit logs
- Bypass volume so high it suggests the guardrails are not being operated as
  policy (a **heuristic** some orgs monitor; not enforced by Ripstop)
- Staying **many majors** behind current releases without a documented risk
  acceptance

**It does *not* mean** you lose access to the software (MIT). It does **not**
mean a vendor withholds fixes — there is no vendor. It **does** mean
**upstream triage may deprioritise** drive-by requests from repos that appear
to be ignoring the shared rules, because signal-to-noise matters for a small
maintainer pool.

Returning to “in contract” behaviour is: fix the hygiene issues above and
engage on **GitHub** with actionable reports.

### 21.4 Why this is in the spec

A package without a consumer contract is a tool people **misconfigure and
abandon**. A package with one is a **product people can rely on** — even
when maintenance is volunteer-driven, because expectations are explicit.

The playbook is the runbook. This section is the short constitution.

---

## 22. What the package can and cannot prevent

The package is a tripwire, not a wall. Honest framing of its limits is
part of the spec because consumers and security reviewers should not
mistake the one for the other.

### 22.1 What the package reliably prevents

Failures the package catches with high confidence, against any agent or
human using the standard Git workflow:

- **PII appearing in source files** committed via the normal flow.
Caught by `pii` at pre-commit and CI.
- **Modifications to change-controlled paths** without explicit human
attestation. Caught by `path-guard` at pre-commit and CI.
- **Casual self-bypass via guardrails config edit** — changing
`.guardrails.yaml`, `.guardrails/`, `RIPSTOP.md`, or Claude settings
fragments without a `CHANGE-APPROVED` trailer in the commit message.
Preset defaults include these paths under `path-guard`; the check fails
the commit the same way as for other protected paths.
- **New test-skip annotations** without ticket references. Caught by
`test-skip` at pre-commit and CI.
- **New runtime dependencies** without an accompanying ADR. Caught by
`dependency-guard` at pre-commit and CI.
- **Force-pushes and branch deletions** on protected branches. Caught
by `history-guard` at pre-push.
- **Rebases of already-pushed commits.** Caught by `history-guard` at
pre-rebase.
- **Loss of forensic recovery data** after a destructive operation.
Mitigated by `reflog-witness`'s continuous capture of repository state,
including hashes (and content on change) of `.guardrails.yaml` and the
hash of `RIPSTOP.md` for configuration drift investigation.

### 22.2 What the package partially prevents

Failures where the package raises the cost of the bad action but does
not eliminate it:

- **Destruction of unstaged working-tree changes.** `working-tree-guard`
protects against this *only* when the agent's harness is configured to
call `ripstop snapshot` before destructive operations. An
agent that bypasses the wrapper defeats it. Per-agent harness wiring
is documented separately; the more conservative the harness
configuration, the stronger the protection.
- **Bypass abuse.** `--no-verify` and the configured bypass trailer
exist for legitimate emergencies. Both are logged. The package surfaces
abuse patterns in the audit log; preventing abuse outright is a human
process concern, not a software concern.
- **Local override drift.** Repos can set `mode: off` or add broad
exemptions. Governance (§6 of the playbook) and the consumer contract
(§21 of this spec) raise the cost; they don't eliminate the option.
- **Pre-action agent compliance with guardrails.** The generated
`RIPSTOP.md` (from `ripstop generate-md`) places the active rules in the
agent's session context, which raises the probability the agent gets
things right first time. It does not guarantee compliance — agent-config
files are advisory, and a determined or jailbroken agent can ignore them.
The Layer 2 enforcement at commit time remains the binding control.
- **Self-protection of agent-config files (Cursor, Codex, Amazon Q).**
Generated “do not modify guardrails files” prose in `RIPSTOP.md` is
advisory — same limits as Layer 1 generally. **Claude Code** can merge
`.claude/settings.ripstop.json` (from `ripstop generate-md --format claude`)
into `settings.json`; `permissions.deny` there is harness-enforced when
the merge is applied.

### 22.3 What the package does not prevent

Failures the package is not designed to catch and which require other
controls:

- **Direct filesystem destruction outside Git.** An agent with shell
access running `rm -rf src/` deletes files before any Git hook fires.
The mitigation is filesystem-level snapshotting (Time Machine, `btrfs`
snapshots, ZFS, or an `fswatch`-driven backup) running outside the
agent's reach. The package documents this; it does not implement it.
- **Server-side history rewrites.** A user with admin rights on the Git
server can rewrite history in ways no client-side hook can prevent.
Server-side branch protection (GitHub branch rules, GitLab protected
branches, Bitbucket equivalents) is the correct control. The package
pairs with these but does not replace them.
- **Malicious agent behaviour.** The package assumes agents are
well-intentioned and well-configured. An adversarial agent
deliberately working around the package's hooks (e.g., editing
`.husky/pre-commit` to a no-op, then committing) will succeed unless
caught by code review. The package logs every invocation and the
audit log will show the gap, but prevention requires human review.
- **Secrets already in Git history.** The package catches secrets at
the commit boundary. Secrets already committed before the package was
installed, or committed via `--no-verify`, remain in history. Use a
history scanner (gitleaks against the full log, BFG Repo-Cleaner for
removal) for retrospective coverage.
- **Network egress, API call patterns, runtime data exfiltration.**
These are runtime concerns. They belong in the agent harness's
permissions configuration (Layer 3 in the guardrails model), not in a
Git-time check.

### 22.4 The layered model, restated

The original three-layer model from the package's design intent:

1. **Layer 1 — Agent configuration** (AGENTS.md, `.cursorrules`,
  `.claude/settings.json`). Advisory. Stops willing agents.
2. **Layer 2 — Repo-local hooks and CI checks** (this package).
  Enforced regardless of agent at Git boundaries. Catches the
   standard-workflow failures in §22.1.
3. **Layer 3 — Sandbox and permission boundaries** (agent harness
  permissions, IAM, container sandboxing, filesystem snapshotting).
   The strongest layer; lives outside this package.

This package is primarily Layer 2. Two capabilities reach adjacent
layers without changing that classification:

- **`working-tree-guard`** spans Layer 2 and Layer 3: its pre-commit mode
  is pure Layer 2 (orphan detection at commit time), but its pre-action
  mode requires Layer 3 cooperation (the agent's harness must invoke
  `ripstop snapshot` before destructive operations). Where Layer
  3 cooperation is unavailable, it degrades to commit-time orphan
  warnings only.
- **Generated `RIPSTOP.md`** populates Layer 1 (agent-readable config)
  from the same resolved configuration that drives Layer 2 enforcement.
  It reduces drift between what agents read and what hooks enforce; it
  does not replace a well-maintained `AGENTS.md` or harness sandboxing.
- **Self-protection copy and optional Claude deny JSON** extend that
  Layer 1 reach with explicit “do not modify guardrails files” rules;
  binding enforcement for those paths remains `path-guard` at commit
  time.

The package is most effective when deployed alongside Layers 1 and 3,
not in place of them. Selling it as "comprehensive AI safety" is
overpromising; selling it as "the missing middle layer that makes the
other two layers actually enforceable" is honest and accurate.