/**
 * @module CliTests
 * Tests for Ripstop CLI argument parsing.
 */
// Copyright (c) 2026 Jon Verrier

import { expect } from 'expect';
import { parseArgs } from '../src/cli';

describe('CLI', () => {
  it('parses check command arguments', () => {
    const command = parseArgs([
      'check',
      '--staged',
      '--trigger',
      'commit-msg',
      '--commit-msg-file',
      '.git/COMMIT_EDITMSG',
      '--check',
      'path-guard',
      '--format',
      'json'
    ]);

    expect(command).toMatchObject({
      command: 'check',
      trigger: 'commit-msg',
      commitMsgFile: '.git/COMMIT_EDITMSG',
      requestedChecks: ['path-guard'],
      format: 'json'
    });
  });

  it('defaults ci checks to all tracked files', () => {
    const command = parseArgs(['check', '--trigger', 'ci']);

    expect(command).toMatchObject({
      command: 'check',
      trigger: 'ci',
      selection: { kind: 'all' }
    });
  });

  it('parses explain command', () => {
    const command = parseArgs(['explain', 'pii', '--resolved', '--config', 'custom.yaml']);

    expect(command).toEqual({
      command: 'explain',
      check: 'pii',
      resolved: true,
      configPath: 'custom.yaml'
    });
  });

  it('parses recover --config-history', () => {
    const command = parseArgs(['recover', '--config-history', '--since', '2026-01-01T00:00:00.000Z']);

    expect(command).toMatchObject({
      command: 'recover',
      configHistory: true,
      since: '2026-01-01T00:00:00.000Z',
      configPath: '.guardrails.yaml'
    });
  });
});
