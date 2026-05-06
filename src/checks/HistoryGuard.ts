/**
 * @module HistoryGuard
 * Blocks destructive remote history operations in pre-push contexts.
 */
// Copyright (c) 2026 Jon Verrier

import picomatch from 'picomatch';
import { z } from 'zod';
import { ICheck, ICheckContext, IFinding } from './types';

const ZERO_SHA = '0000000000000000000000000000000000000000';

const HistoryGuardConfigSchema = z.object({
  protected_branches: z.array(z.string()).default(['main', 'master', 'develop', 'release/*']),
  block_force_push: z.boolean().default(true),
  block_branch_delete_on_remote: z.boolean().default(true)
}).passthrough();

export const historyGuardCheck: ICheck = {
  name: 'history-guard',
  description: 'Blocks destructive pushes to protected branches.',
  supportedTriggers: ['pre-push'],
  configSchema: HistoryGuardConfigSchema,
  async run(ctx: ICheckContext): Promise<IFinding[]> {
    const config = HistoryGuardConfigSchema.parse(ctx.config);
    const payload = ctx.pushPayload;
    if (!payload) {
      return [];
    }

    const protectedMatchers = config.protected_branches.map((branch) => picomatch(branch));
    const findings: IFinding[] = [];

    for (const ref of payload.refs) {
      const branchName = remoteBranchName(ref.remoteRef);
      if (!branchName || !protectedMatchers.some((matcher) => matcher(branchName))) {
        continue;
      }

      if (config.block_branch_delete_on_remote && ref.isDelete) {
        findings.push({
          check: 'history-guard',
          severity: ctx.mode === 'enforce' ? 'error' : 'warning',
          message: `Remote branch deletion is blocked for protected branch "${branchName}".`,
          ruleId: 'history-guard.branch-delete'
        });
      }

      if (config.block_force_push && ref.isForceUpdate) {
        findings.push({
          check: 'history-guard',
          severity: ctx.mode === 'enforce' ? 'error' : 'warning',
          message: `Force push is blocked for protected branch "${branchName}".`,
          ruleId: 'history-guard.force-push'
        });
      }
    }

    return findings;
  }
};

export function parsePrePushInput(remote: string, input: string): Array<{ localRef: string; localSha: string; remoteRef: string; remoteSha: string; isForceUpdate: boolean; isDelete: boolean }> {
  return input.split(/\r?\n/).filter(Boolean).map((line) => {
    const [localRef = '', localSha = '', remoteRef = '', remoteSha = ''] = line.trim().split(/\s+/);
    return {
      localRef,
      localSha,
      remoteRef,
      remoteSha,
      isForceUpdate: localRef.startsWith('+'),
      isDelete: localSha === ZERO_SHA
    };
  });
}

function remoteBranchName(remoteRef: string): string | undefined {
  const prefix = 'refs/heads/';
  return remoteRef.startsWith(prefix) ? remoteRef.slice(prefix.length) : undefined;
}
