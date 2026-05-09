/**
 * @module ReflogWitness
 * Appends guardrails configuration snapshots to the witness log for forensic recovery.
 */
// Copyright (c) 2026 Jon Verrier

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import * as childProcess from 'child_process';
import { z } from 'zod';
import { ICheck, ICheckContext, IFinding } from './types';
import { IRipstopConfig } from '../config/schema';

const execFile = promisify(childProcess.execFile);

const DEFAULT_MAX_CONTENT_BYTES = 1_000_000;

const ReflogWitnessConfigSchema = z.object({
  guardrails_config_path: z.string().min(1).default('.guardrails.yaml'),
  ripstop_md_path: z.string().min(1).default('RIPSTOP.md'),
  max_content_bytes: z.number().int().positive().default(DEFAULT_MAX_CONTENT_BYTES)
}).passthrough();

export const reflogWitnessCheck: ICheck = {
  name: 'reflog-witness',
  description: 'Records .guardrails.yaml hash (and content on change) plus RIPSTOP.md hash in the witness log.',
  supportedTriggers: ['pre-commit', 'pre-push', 'pre-rebase', 'ci'],
  configSchema: ReflogWitnessConfigSchema,
  async run(ctx: ICheckContext): Promise<IFinding[]> {
    const local = ReflogWitnessConfigSchema.parse(ctx.config);
    const resolved = ctx.resolvedRipstopConfig as IRipstopConfig;
    const witnessRel = resolved.reporting.witness_log;
    const witnessAbs = path.join(ctx.repoRoot, witnessRel);

    const guardrailsRel = local.guardrails_config_path;
    const guardrailsAbs = path.isAbsolute(guardrailsRel)
      ? guardrailsRel
      : path.join(ctx.repoRoot, guardrailsRel);

    let yamlText = '';
    try {
      yamlText = await fs.readFile(guardrailsAbs, 'utf8');
    } catch {
      yamlText = '';
    }

    const hash = sha256Hex(yamlText);
    const ripRel = local.ripstop_md_path;
    const ripAbs = path.isAbsolute(ripRel) ? ripRel : path.join(ctx.repoRoot, ripRel);
    let ripstopMdHash = '';
    try {
      ripstopMdHash = sha256Hex(await fs.readFile(ripAbs, 'utf8'));
    } catch {
      ripstopMdHash = sha256Hex('');
    }

    const last = await readLastWitnessConfigEntry(witnessAbs, guardrailsRel);
    const contentChanged = last?.hash !== hash;
    const record: Record<string, unknown> = {
      type: 'reflog-witness',
      trigger: ctx.trigger,
      branch: await readGitBranch(ctx.repoRoot),
      config: {
        path: guardrailsRel,
        hash
      },
      ripstop_md_hash: ripstopMdHash
    };

    if (contentChanged && yamlText.length <= local.max_content_bytes) {
      (record.config as Record<string, unknown>).content = yamlText;
    }

    await ctx.witness.append(record);
    return [];
  }
};

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

async function readGitBranch(repoRoot: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFile('git', ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      maxBuffer: 1024 * 1024
    });
    const branch = stdout.trim();
    return branch.length > 0 ? branch : undefined;
  } catch {
    return undefined;
  }
}

interface ILastWitnessEntry {
  hash?: string;
}

async function readLastWitnessConfigEntry(witnessAbsPath: string, configPathKey: string): Promise<ILastWitnessEntry | undefined> {
  try {
    const raw = await fs.readFile(witnessAbsPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]) as Record<string, unknown>;
        if (parsed.type !== 'reflog-witness' || !parsed.config || typeof parsed.config !== 'object') {
          continue;
        }
        const cfg = parsed.config as { path?: string; hash?: string };
        if (cfg.path === configPathKey && typeof cfg.hash === 'string') {
          return { hash: cfg.hash };
        }
      } catch {
        continue;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
