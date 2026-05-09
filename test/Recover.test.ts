/**
 * @module RecoverTests
 * Tests for `ripstop recover` CLI parsing.
 */
// Copyright (c) 2026 Jon Verrier

import { expect } from 'expect';
import { parseRecoverArgs } from '../src/recover';

describe('Recover', () => {
  it('parseRecoverArgs requires --config-history', () => {
    expect(() => parseRecoverArgs([])).toThrow(/requires --config-history/);
  });

  it('parseRecoverArgs parses --since and --config', () => {
    const command = parseRecoverArgs(['--config-history', '--since', '2026-01-01T00:00:00.000Z', '--config', 'custom.yaml']);

    expect(command.configHistory).toBe(true);
    expect(command.since).toBe('2026-01-01T00:00:00.000Z');
    expect(command.configPath).toBe('custom.yaml');
  });
});
