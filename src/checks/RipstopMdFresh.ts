/**
 * @module RipstopMdFresh
 * Fails when RIPSTOP.md is missing or its embedded config hash does not match the resolved config.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module defines a check that ensures the generated RIPSTOP.md file is present and matches the current resolved Ripstop configuration. It is intended to fail in pre-commit and CI when the documentation is missing or stale. The main export is ripstopMdFreshCheck, an ICheck implementation with a Zod-backed config schema that accepts output_path (defaulting to RIPSTOP.md). On run, it resolves the output path relative to the repo root, reads the file with fs/promises, and reports a finding if the file is missing. It computes the expected configuration hash using hashResolvedRipstopConfig over the resolved IRipstopConfig from the check context, then extracts the embedded hash from the markdown via extractEmbeddedConfigHash. If the hash is absent or does not match, it returns a warning or error finding depending on ctx.mode, with rule IDs for missing, no-hash, and stale cases. Key dependencies include Node path utilities, Zod for configuration parsing, and shared types for check context and findings.
// ===End StrongAI Generated Comment===


import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { ICheck, ICheckContext, IFinding } from './types';
import { hashResolvedRipstopConfig } from '../config/configHash';
import { IRipstopConfig } from '../config/schema';
import { extractEmbeddedConfigHash } from '../generators/markdown';

const RipstopMdFreshConfigSchema = z.object({
  output_path: z.string().min(1).default('RIPSTOP.md')
}).passthrough();

export const ripstopMdFreshCheck: ICheck = {
  name: 'ripstop-md-fresh',
  description: 'Ensures RIPSTOP.md reflects the current resolved guardrails configuration.',
  supportedTriggers: ['pre-commit', 'ci'],
  configSchema: RipstopMdFreshConfigSchema,
  async run(ctx: ICheckContext): Promise<IFinding[]> {
    const local = RipstopMdFreshConfigSchema.parse(ctx.config);
    const resolved = ctx.resolvedRipstopConfig as IRipstopConfig;
    const expectedHash = hashResolvedRipstopConfig(resolved);
    const outputPath = path.isAbsolute(local.output_path)
      ? local.output_path
      : path.join(ctx.repoRoot, local.output_path);

    let body: string;
    try {
      body = await fs.readFile(outputPath, 'utf8');
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code === 'ENOENT') {
        return [missingFileFinding(ctx, local.output_path)];
      }
      throw error;
    }

    const embedded = extractEmbeddedConfigHash(body);
    if (!embedded) {
      return [staleFinding(ctx, local.output_path, 'RIPSTOP.md has no embedded config hash. Regenerate: ripstop generate-md', 'ripstop-md-fresh.no-hash')];
    }

    if (embedded !== expectedHash.toLowerCase()) {
      return [staleFinding(
        ctx,
        local.output_path,
        'RIPSTOP.md is out of date. Config has changed since RIPSTOP.md was last generated. Regenerate: ripstop generate-md',
        'ripstop-md-fresh.stale'
      )];
    }

    return [];
  }
};

function missingFileFinding(ctx: ICheckContext, outputPath: string): IFinding {
  return {
    check: 'ripstop-md-fresh',
    severity: ctx.mode === 'enforce' ? 'error' : 'warning',
    file: outputPath,
    message: `RIPSTOP.md is missing at "${outputPath}". Generate it once: ripstop generate-md`,
    ruleId: 'ripstop-md-fresh.missing'
  };
}

function staleFinding(ctx: ICheckContext, outputPath: string, message: string, ruleId: string): IFinding {
  return {
    check: 'ripstop-md-fresh',
    severity: ctx.mode === 'enforce' ? 'error' : 'warning',
    file: outputPath,
    message,
    ruleId
  };
}
