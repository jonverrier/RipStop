/**
 * @module ClaudeDenySettings
 * Generates merge-ready Claude Code permissions.deny fragment for self-protection.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module generates a small JSON fragment that can be merged into Claude Code settings to help prevent an agent from weakening or removing its own guardrails. It is intended to be written to `.claude/settings.ripstop.json` and then merged into the main `.claude/settings.json` according to Claude Code’s settings merge behavior.
// 
// The module exports a single function, buildClaudeRipstopDenySettingsJson. It constructs an object containing a `permissions.deny` list and returns it as pretty-printed JSON with a trailing newline. The deny rules block Edit and Write operations against the primary guardrails file, anything under the `.guardrails/` directory, the RIPSTOP.md document, and the Claude settings file itself. This effectively discourages automated changes to policy and configuration files that define or enforce protection.
// 
// There are no imported dependencies. It relies only on standard JavaScript JSON serialization via `JSON.stringify` to produce stable, merge-ready output.
// ===End StrongAI Generated Comment===


/**
 * JSON body for `.claude/settings.ripstop.json` (merge into `settings.json` per docs).
 */
export function buildClaudeRipstopDenySettingsJson(): string {
  const body = {
    permissions: {
      deny: [
        'Edit(.guardrails.yaml)',
        'Edit(.guardrails/**)',
        'Edit(RIPSTOP.md)',
        'Write(.guardrails.yaml)',
        'Write(.guardrails/**)',
        'Edit(.claude/settings.json)',
        'Write(.claude/settings.json)'
      ]
    }
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}
