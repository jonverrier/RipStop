/**
 * @module GenerateMdTests
 * Tests for RIPSTOP.md generation, hashing, and CLI wiring.
 */
// Copyright (c) 2026 Jon Verrier

import * as fs from 'fs/promises';
import * as path from 'path';
import { expect } from 'expect';
import { parseArgs } from '../src/cli';
import { hashResolvedRipstopConfig, stableStringify } from '../src/config/configHash';
import { loadConfig } from '../src/config/load';
import { parseGenerateMdArgs, runGenerateMd } from '../src/generateMd';
import { extractEmbeddedConfigHash, generateRipstopMarkdown } from '../src/generators/markdown';

describe('GenerateMd', () => {
  it('computes stable hashes for equivalent config objects', () => {
    const a = { z: 1, y: { b: 2, a: 1 } };
    const b = { y: { a: 1, b: 2 }, z: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('embeds and reads config hash from generated markdown', async () => {
    const fixtureRoot = path.join(process.cwd(), 'test', 'fixtures', 'generated-md', 'minimal');
    const config = await loadConfig(fixtureRoot, '.guardrails.yaml');
    const hash = hashResolvedRipstopConfig(config);
    const md = generateRipstopMarkdown(config, {
      packageVersion: '0.2.0',
      generatedAtIso: '2026-05-06T12:00:00.000Z',
      configHash: hash,
      format: 'markdown'
    });
    expect(md).toContain('## What you must not modify');
    expect(extractEmbeddedConfigHash(md)).toBe(hash);
    const goldenPath = path.join(fixtureRoot, 'RIPSTOP.golden.md');
    const golden = await fs.readFile(goldenPath, 'utf8');
    expect(md).toBe(golden);
  });

  it('parses generate-md CLI', () => {
    const command = parseArgs([
      'generate-md',
      '--output',
      'out/RIPSTOP.md',
      '--format',
      'claude',
      '--dry-run'
    ]);

    expect(command).toMatchObject({
      command: 'generate-md',
      outputPath: 'out/RIPSTOP.md',
      format: 'claude',
      dryRun: true,
      checkFresh: false
    });
  });

  it('parseGenerateMdArgs handles --check-fresh', () => {
    const command = parseGenerateMdArgs(['--check-fresh', '--output', 'RIPSTOP.md']);
    expect(command.checkFresh).toBe(true);
    expect(command.outputPath).toBe('RIPSTOP.md');
  });

  it('runGenerateMd with format claude writes .claude/settings.ripstop.json', async () => {
    const tmp = await fs.mkdtemp(path.join(require('os').tmpdir(), 'ripstop-claude-'));
    await fs.writeFile(path.join(tmp, '.guardrails.yaml'), `
repo:
  name: z
  domain: z
  tier: 2
extends: "@jonverrier/ripstop/presets/internal-tooling"
`, 'utf8');

    const exitCode = await runGenerateMd(tmp, {
      command: 'generate-md',
      configPath: '.guardrails.yaml',
      outputPath: 'RIPSTOP.md',
      format: 'claude',
      checkFresh: false,
      dryRun: false
    });

    expect(exitCode).toBe(0);
    const raw = await fs.readFile(path.join(tmp, '.claude', 'settings.ripstop.json'), 'utf8');
    const parsed = JSON.parse(raw) as { permissions?: { deny?: string[] } };
    expect(parsed.permissions?.deny?.some((d) => d.includes('.guardrails.yaml'))).toBe(true);
  });

  it('runGenerateMd check-fresh exits 1 when file missing', async () => {
    const tmp = await fs.mkdtemp(path.join(require('os').tmpdir(), 'ripstop-gen-'));
    const exitCode = await runGenerateMd(tmp, {
      command: 'generate-md',
      configPath: path.join(process.cwd(), 'test', 'fixtures', 'generated-md', 'minimal', '.guardrails.yaml'),
      outputPath: 'MISSING.md',
      format: 'markdown',
      checkFresh: true,
      dryRun: false
    });
    expect(exitCode).toBe(1);
  });
});
