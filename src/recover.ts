/**
 * @module Recover
 * CLI implementation for `ripstop recover --config-history`.
 */
// Copyright (c) 2026 Jon Verrier

import * as fs from 'fs/promises';
import * as path from 'path';
import { InvalidParameterError } from '@jonverrier/assistant-common';
import { loadConfig } from './config/load';

export interface IRecoverCommand {
  readonly command: 'recover';
  configHistory: boolean;
  since?: string;
  configPath: string;
}

/**
 * Parses `recover` argv (excluding the `recover` token).
 * @param args - Remaining CLI arguments.
 */
export function parseRecoverArgs(args: string[]): IRecoverCommand {
  let configHistory = false;
  let since: string | undefined;
  let configPath = '.guardrails.yaml';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--config-history') {
      configHistory = true;
    } else if (arg === '--since') {
      since = requireValue(args, ++i, '--since');
    } else if (arg === '--config') {
      configPath = requireValue(args, ++i, '--config');
    } else {
      throw new InvalidParameterError(`Unknown recover option: ${arg}`);
    }
  }

  if (!configHistory) {
    throw new InvalidParameterError('recover currently requires --config-history');
  }

  return {
    command: 'recover',
    configHistory,
    since,
    configPath
  };
}

/**
 * Prints chronological reflog-witness configuration snapshots from the witness log.
 * @param repoRoot - Repository root.
 * @param command - Parsed recover command.
 */
export async function runRecoverConfigHistory(repoRoot: string, command: IRecoverCommand): Promise<void> {
  const config = await loadConfig(repoRoot, command.configPath);
  const witnessAbs = path.join(repoRoot, config.reporting.witness_log);

  let raw: string;
  try {
    raw = await fs.readFile(witnessAbs, 'utf8');
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === 'ENOENT') {
      process.stdout.write(`No witness log at ${witnessAbs}\n`);
      return;
    }
    throw error;
  }

  let sinceMs: number | undefined;
  if (command.since !== undefined) {
    sinceMs = Date.parse(command.since);
    if (Number.isNaN(sinceMs)) {
      throw new InvalidParameterError(`Invalid --since timestamp: ${command.since}`);
    }
  }

  const entries: { ts: string; line: string }[] = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed.type !== 'reflog-witness') {
        continue;
      }
      const ts = typeof parsed.timestamp === 'string' ? parsed.timestamp : '';
      if (sinceMs !== undefined) {
        const rowMs = Date.parse(ts);
        if (!Number.isNaN(rowMs) && rowMs < sinceMs) {
          continue;
        }
      }
      entries.push({ ts, line: JSON.stringify(parsed, null, 2) });
    } catch {
      continue;
    }
  }

  entries.sort((a, b) => a.ts.localeCompare(b.ts));
  for (const entry of entries) {
    process.stdout.write(`${entry.line}\n\n`);
  }

  if (entries.length === 0) {
    process.stdout.write('No reflog-witness configuration snapshots found.\n');
  }
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new InvalidParameterError(`${flag} requires a value`);
  }
  return value;
}
