/**
 * @module ChecksTests
 * Tests for built-in Ripstop checks.
 */
// Copyright (c) 2026 Jon Verrier

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { expect } from 'expect';
import { pathGuardCheck } from '../src/checks/PathGuard';
import { testSkipCheck } from '../src/checks/TestSkip';
import { piiCheck } from '../src/checks/Pii';
import { parsePrePushInput, historyGuardCheck } from '../src/checks/HistoryGuard';
import { AuditWriter } from '../src/logs/AuditWriter';
import { WitnessWriter } from '../src/logs/WitnessWriter';
import { ICheckContext, IFileEntry } from '../src/checks/types';

describe('Checks', () => {
  it('path-guard flags protected files without approval trailer', async () => {
    const ctx = await createContext({
      trigger: 'commit-msg',
      mode: 'enforce',
      config: {
        protected_paths: ['infra/**'],
        approval_trailer: 'CHANGE-APPROVED'
      },
      commitMessage: 'Update infra',
      files: [fileEntry('infra/main.tf', 'resource test {}')]
    });

    const findings = await pathGuardCheck.run(ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('path-guard.approval-trailer');
  });

  it('path-guard accepts approval trailer', async () => {
    const ctx = await createContext({
      trigger: 'commit-msg',
      mode: 'enforce',
      config: {
        protected_paths: ['infra/**'],
        approval_trailer: 'CHANGE-APPROVED'
      },
      commitMessage: 'Update infra\n\nCHANGE-APPROVED: CAB-123',
      files: [fileEntry('infra/main.tf', 'resource test {}')]
    });

    const findings = await pathGuardCheck.run(ctx);

    expect(findings).toHaveLength(0);
  });

  it('test-skip flags new skip annotations without ticket references', async () => {
    const ctx = await createContext({
      trigger: 'pre-commit',
      mode: 'warn',
      config: {
        blocked_annotations: ['.skip('],
        require_ticket: true
      },
      files: [
        fileEntry('test/example.test.ts', '', {
          diff: '+describe.skip("suite", () => {})\n'
        })
      ]
    });

    const findings = await testSkipCheck.run(ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('pii flags email addresses outside exemptions', async () => {
    const ctx = await createContext({
      trigger: 'pre-commit',
      mode: 'enforce',
      config: {},
      files: [fileEntry('src/example.ts', 'const email = "person@example.com";')]
    });

    const findings = await piiCheck.run(ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('pii.email');
  });

  it('history-guard flags protected force pushes', async () => {
    const ctx = await createContext({
      trigger: 'pre-push',
      mode: 'enforce',
      config: {
        protected_branches: ['main'],
        block_force_push: true
      },
      pushPayload: {
        remote: 'origin',
        refs: [{
          localRef: '+refs/heads/main',
          localSha: '1111111111111111111111111111111111111111',
          remoteRef: 'refs/heads/main',
          remoteSha: '2222222222222222222222222222222222222222',
          isForceUpdate: true,
          isDelete: false
        }]
      },
      files: []
    });

    const findings = await historyGuardCheck.run(ctx);

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('history-guard.force-push');
  });

  it('parses pre-push hook input', () => {
    const refs = parsePrePushInput('origin', '+refs/heads/main 111 refs/heads/main 222\n');

    expect(refs[0]).toMatchObject({
      localRef: '+refs/heads/main',
      remoteRef: 'refs/heads/main',
      isForceUpdate: true,
      isDelete: false
    });
  });
});

async function createContext(overrides: Partial<ICheckContext>): Promise<ICheckContext> {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ripstop-check-'));
  return {
    repoRoot,
    trigger: 'pre-commit',
    files: [],
    config: {},
    mode: 'warn',
    audit: new AuditWriter(path.join(repoRoot, '.git/ripstop/audit.jsonl'), '0.1.0', 'test'),
    witness: new WitnessWriter(path.join(repoRoot, '.git/ripstop/witness.jsonl'), '0.1.0', 'test'),
    ...overrides
  };
}

function fileEntry(filePath: string, content: string, options: { diff?: string } = {}): IFileEntry {
  return {
    path: filePath,
    isNew: false,
    isDeleted: false,
    content: async () => content,
    diff: options.diff ? async () => options.diff ?? '' : undefined
  };
}
