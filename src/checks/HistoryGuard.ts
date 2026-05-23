/**
 * @module HistoryGuard
 * Blocks destructive remote history operations in pre-push contexts.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module enforces safe Git push behavior by detecting destructive remote history operations during pre-push hooks. It focuses on protected branches and reports findings when a push attempts to delete a protected remote branch or perform a force update. The main export, historyGuardCheck, is an ICheck implementation that runs in the pre-push trigger. It validates and normalizes configuration with a Zod schema, supports glob-style protected branch patterns, and returns IFinding entries with severity based on the current mode (warning in non-enforced runs, error in enforce mode). The other export, parsePrePushInput, parses the raw pre-push stdin text into ref update records, marking force updates via a leading “+” on the local ref and deletions via the all-zero SHA. The module relies on picomatch to compile branch globs into matchers, and on zod to define defaults and safely parse user config.
// ===End StrongAI Generated Comment===


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
