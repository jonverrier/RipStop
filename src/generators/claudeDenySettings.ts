/**
 * @module ClaudeDenySettings
 * Generates merge-ready Claude Code permissions.deny fragment for self-protection.
 */
// Copyright (c) 2026 Jon Verrier

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
