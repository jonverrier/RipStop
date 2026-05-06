/**
 * @module ConfigTests
 * Tests for Ripstop config loading and merging.
 */
// Copyright (c) 2026 Jon Verrier

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { expect } from 'expect';
import { deepMerge, loadConfig } from '../src/config/load';

describe('Config', () => {
  it('replaces arrays while deep-merging objects', () => {
    const merged = deepMerge(
      { checks: { pii: { mode: 'warn', triggers: ['pre-commit'], nested: { a: 1 } } } },
      { checks: { pii: { triggers: ['ci'], nested: { b: 2 } } } }
    );

    expect(merged).toEqual({
      checks: {
        pii: {
          mode: 'warn',
          triggers: ['ci'],
          nested: { a: 1, b: 2 }
        }
      }
    });
  });

  it('loads built-in presets and lets repo config override them', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ripstop-config-'));
    await fs.writeFile(path.join(repoRoot, '.guardrails.yaml'), `
repo:
  name: example
  domain: tooling
  tier: 2
extends: "@jonverrier/ripstop/presets/internal-tooling"
checks:
  test-skip:
    mode: enforce
`, 'utf8');

    const config = await loadConfig(repoRoot);

    expect(config.repo.name).toBe('example');
    expect(config.checks['test-skip'].mode).toBe('enforce');
    expect(config.checks['path-guard'].mode).toBe('enforce');
    expect(config.reporting.audit_log).toBe('.git/ripstop/audit.jsonl');
  });

  it('resolves telco-bss preset through chained extends', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ripstop-config-bss-'));
    await fs.writeFile(path.join(repoRoot, '.guardrails.yaml'), `
repo:
  name: bss-example
  domain: bss
  tier: 1
extends: "@jonverrier/ripstop/presets/telco-bss"
`, 'utf8');

    const config = await loadConfig(repoRoot);

    expect(config.checks['ripstop-md-fresh'].mode).toBe('enforce');
    expect(config.checks['path-guard'].mode).toBe('enforce');
    expect(config.checks['pii'].mode).toBe('warn');
  });
});
