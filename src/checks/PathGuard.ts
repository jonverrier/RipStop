/**
 * @module PathGuard
 * Protects change-controlled paths with commit-message approval trailers.
 */
// Copyright (c) 2026 Jon Verrier

import picomatch from 'picomatch';
import { z } from 'zod';
import { ICheck, ICheckContext, IFinding } from './types';

const DEFAULT_APPROVAL_TRAILER = 'CHANGE-APPROVED';

const PathGuardConfigSchema = z.object({
  protected_paths: z.array(z.string()).default([]),
  approval_trailer: z.string().default(DEFAULT_APPROVAL_TRAILER)
}).passthrough();

export const pathGuardCheck: ICheck = {
  name: 'path-guard',
  description: 'Requires an approval trailer when protected paths are modified.',
  supportedTriggers: ['commit-msg', 'ci'],
  configSchema: PathGuardConfigSchema,
  async run(ctx: ICheckContext): Promise<IFinding[]> {
    const config = PathGuardConfigSchema.parse(ctx.config);
    const matchers = config.protected_paths.map((pattern) => picomatch(pattern));
    const protectedFiles = ctx.files.filter((file) => matchers.some((matcher) => matcher(file.path)));

    if (protectedFiles.length === 0) {
      return [];
    }

    if (hasTrailer(ctx.commitMessage, config.approval_trailer)) {
      return [];
    }

    return protectedFiles.map((file) => ({
      check: 'path-guard',
      severity: ctx.mode === 'enforce' ? 'error' : 'warning',
      file: file.path,
      message: `Protected path modified without ${config.approval_trailer}: <reason> in the commit message.`,
      ruleId: 'path-guard.approval-trailer'
    }));
  }
};

function hasTrailer(commitMessage: string | undefined, trailer: string): boolean {
  if (!commitMessage) {
    return false;
  }
  const trailerPrefix = `${trailer}:`;
  return commitMessage.split(/\r?\n/).some((line) => line.trim().startsWith(trailerPrefix));
}
