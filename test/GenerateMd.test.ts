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
      packageVersion: '0.1.0',
      generatedAtIso: '2026-05-06T12:00:00.000Z',
      configHash: hash,
      format: 'markdown'
    });
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
