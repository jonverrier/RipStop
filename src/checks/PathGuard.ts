/**
 * @module PathGuard
 * Protects change-controlled paths with commit-message approval trailers.
 */
// Copyright (c) 2026 Jon Verrier

import { z } from 'zod';
import { ICheck, ICheckContext, IFinding } from './types';
import { isGuardrailsSelfProtectionPath, matchGlobPattern } from './selfProtectionPaths';

const DEFAULT_APPROVAL_TRAILER = 'CHANGE-APPROVED';

const DEFAULT_SELF_PROTECTION_MESSAGE = [
  'You are attempting to modify a guardrails configuration file.',
  'Modifying these files to bypass a check is itself a guardrail violation.',
  'Open this change as a separate PR with rationale, and include CHANGE-APPROVED: <ticket> <reason> in the commit message.'
].join(' ');

const PathGuardConfigSchema = z.object({
  protected_paths: z.array(z.string()).default([]),
  approval_trailer: z.string().default(DEFAULT_APPROVAL_TRAILER),
  self_protection_message: z.string().optional()
}).passthrough();

export const pathGuardCheck: ICheck = {
  name: 'path-guard',
  description: 'Requires an approval trailer when protected paths are modified.',
  supportedTriggers: ['commit-msg', 'ci'],
  configSchema: PathGuardConfigSchema,
  async run(ctx: ICheckContext): Promise<IFinding[]> {
    const config = PathGuardConfigSchema.parse(ctx.config);
    const protectedFiles = ctx.files.filter((file) =>
      config.protected_paths.some((pattern) => matchGlobPattern(pattern, file.path))
    );

    if (protectedFiles.length === 0) {
      return [];
    }

    if (hasTrailer(ctx.commitMessage, config.approval_trailer)) {
      return [];
    }

    const selfMsg = typeof config.self_protection_message === 'string' && config.self_protection_message.trim().length > 0
      ? config.self_protection_message.trim()
      : DEFAULT_SELF_PROTECTION_MESSAGE;

    return protectedFiles.map((file) => {
      const self = isGuardrailsSelfProtectionPath(file.path);
      return {
        check: 'path-guard',
        severity: ctx.mode === 'enforce' ? 'error' : 'warning',
        file: file.path,
        message: self
          ? `${selfMsg} (Add ${config.approval_trailer}: <ticket> <reason> to the commit message.)`
          : `Protected path modified without ${config.approval_trailer}: <reason> in the commit message.`,
        ruleId: self ? 'path-guard.self-protection' : 'path-guard.approval-trailer'
      };
    });
  }
};

function hasTrailer(commitMessage: string | undefined, trailer: string): boolean {
  if (!commitMessage) {
    return false;
  }
  const trailerPrefix = `${trailer}:`;
  return commitMessage.split(/\r?\n/).some((line) => line.trim().startsWith(trailerPrefix));
}
