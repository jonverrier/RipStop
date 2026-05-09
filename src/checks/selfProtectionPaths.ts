/**
 * @module SelfProtectionPaths
 * Paths that configure Ripstop itself; used by path-guard messaging and RIPSTOP.md.
 */
// Copyright (c) 2026 Jon Verrier

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
