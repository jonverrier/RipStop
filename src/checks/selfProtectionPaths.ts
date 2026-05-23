/**
 * @module SelfProtectionPaths
 * Paths that configure Ripstop itself; used by path-guard messaging and RIPSTOP.md.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module defines and checks “self-protection” paths for Ripstop and its guardrails tooling. These paths represent configuration files and generated context that should be treated specially by path-guard messaging and referenced in RIPSTOP.md.
// 
// GUARDRAILS_SELF_PROTECTION_GLOBS exports the canonical set of repo-relative patterns that identify protected files, including .guardrails.yaml, the .guardrails directory, RIPSTOP.md, and Claude settings JSON files.
// 
// matchGlobPattern(pattern, filePath) tests a repo-relative path against either a glob pattern or a literal filename. It first normalizes Windows backslashes to forward slashes. For patterns that do not contain glob metacharacters, it performs an exact match or a “ends with /pattern” match to support leading-dot literals anywhere in the repo. For true globs, it delegates matching to the picomatch library with dotfile matching enabled.
// 
// isGuardrailsSelfProtectionPath(filePath) normalizes the input path and returns true if it matches any entry in GUARDRAILS_SELF_PROTECTION_GLOBS, using matchGlobPattern for consistent behavior.
// ===End StrongAI Generated Comment===


import picomatch from 'picomatch';

/** Glob patterns for guardrails configuration and generated agent context (path-guard). */
export const GUARDRAILS_SELF_PROTECTION_GLOBS = [
  '.guardrails.yaml',
  '.guardrails/**',
  'RIPSTOP.md',
  '.claude/settings.json',
  '.claude/settings.ripstop.json'
] as const;

/**
 * Matches a repo-relative path against a glob or literal path (leading-dot literals supported).
 * @param pattern - Glob or literal from config.
 * @param filePath - Repo-relative path.
 */
export function matchGlobPattern(pattern: string, filePath: string): boolean {
  const normalised = filePath.replace(/\\/g, '/');
  if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[')) {
    return normalised === pattern || normalised.endsWith(`/${pattern}`);
  }
  const compile = picomatch as unknown as (p: string, opts?: { dot?: boolean }) => (s: string) => boolean;
  return compile(pattern, { dot: true })(normalised);
}

/**
 * Whether a repo-relative path matches self-protection globs.
 * @param filePath - Path relative to repository root.
 */
export function isGuardrailsSelfProtectionPath(filePath: string): boolean {
  const normalised = filePath.replace(/\\/g, '/');
  return GUARDRAILS_SELF_PROTECTION_GLOBS.some((pattern) => matchGlobPattern(pattern, normalised));
}
