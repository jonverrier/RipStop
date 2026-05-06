/**
 * @module GenerateMd
 * CLI implementation for `ripstop generate-md` and `--check-fresh`.
 */
// Copyright (c) 2026 Jon Verrier

import * as fs from 'fs/promises';
import * as path from 'path';
import { InvalidParameterError } from '@jonverrier/assistant-common';
import { hashResolvedRipstopConfig } from './config/configHash';
import { loadConfig } from './config/load';
import { extractEmbeddedConfigHash, generateRipstopMarkdown, RipstopMdFormat } from './generators/markdown';

const FORMATS: RipstopMdFormat[] = ['markdown', 'claude', 'cursor', 'codex', 'q'];

export interface IGenerateMdCommand {
  readonly command: 'generate-md';
  configPath: string;
  outputPath: string;
  format: RipstopMdFormat;
  checkFresh: boolean;
  dryRun: boolean;
}

/**
 * Parses `generate-md` argv (excluding the `generate-md` token).
 * @param args - Remaining CLI arguments.
 * @returns Parsed command.
 */
export function parseGenerateMdArgs(args: string[]): IGenerateMdCommand {
  let configPath = '.guardrails.yaml';
  let outputPath = 'RIPSTOP.md';
  let format: RipstopMdFormat = 'markdown';
  let checkFresh = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--config':
        configPath = requireValue(args, ++i, '--config');
        break;
      case '--output':
        outputPath = requireValue(args, ++i, '--output');
        break;
      case '--format':
        format = parseMdFormat(requireValue(args, ++i, '--format'));
        break;
      case '--check-fresh':
        checkFresh = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      default:
        throw new InvalidParameterError(`Unknown generate-md option: ${arg}`);
    }
  }

  return {
    command: 'generate-md',
    configPath,
    outputPath,
    format,
    checkFresh,
    dryRun
  };
}

/**
 * Runs generate-md / check-fresh for a repository root.
 * @param repoRoot - Absolute repository root.
 * @param command - Parsed command.
 * @returns Process exit code (0, 1, 2, or 5).
 */
export async function runGenerateMd(repoRoot: string, command: IGenerateMdCommand): Promise<number> {
  const config = await loadConfig(repoRoot, command.configPath);

  const configHash = hashResolvedRipstopConfig(config);
  const packageVersion = await readRipstopPackageVersion();
  const generatedAtIso = new Date().toISOString();
  const resolvedOutput = path.isAbsolute(command.outputPath)
    ? command.outputPath
    : path.join(repoRoot, command.outputPath);

  if (command.checkFresh) {
    return checkFreshness(resolvedOutput, configHash);
  }

  const markdown = generateRipstopMarkdown(config, {
    packageVersion,
    generatedAtIso,
    configHash,
    format: command.format
  });

  if (command.dryRun) {
    process.stdout.write(markdown);
    return 0;
  }

  try {
    await fs.writeFile(resolvedOutput, markdown, 'utf8');
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
    process.stderr.write(`Ripstop failed to write ${resolvedOutput}: ${String(error)}\n`);
    if (code === 'EACCES' || code === 'EPERM' || code === 'ENOSPC') {
      return 5;
    }
    return 5;
  }

  return 0;
}

async function checkFreshness(outputPath: string, expectedHash: string): Promise<number> {
  let body: string;
  try {
    body = await fs.readFile(outputPath, 'utf8');
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === 'ENOENT') {
      process.stderr.write(`RIPSTOP.md is missing at ${outputPath}. Regenerate: ripstop generate-md\n`);
      return 1;
    }
    throw error;
  }

  const embedded = extractEmbeddedConfigHash(body);
  if (!embedded || embedded !== expectedHash.toLowerCase()) {
    process.stderr.write('RIPSTOP.md is out of date relative to the resolved guardrails configuration.\n');
    process.stderr.write('Regenerate: ripstop generate-md\n');
    return 1;
  }

  return 0;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new InvalidParameterError(`${flag} requires a value`);
  }
  return value;
}

function parseMdFormat(value: string): RipstopMdFormat {
  if (FORMATS.includes(value as RipstopMdFormat)) {
    return value as RipstopMdFormat;
  }
  throw new InvalidParameterError(`Invalid --format for generate-md: ${value}. Valid: ${FORMATS.join(', ')}`);
}

async function readRipstopPackageVersion(): Promise<string> {
  const pkgPath = path.join(__dirname, '..', '..', 'package.json');
  const raw = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as { version?: string };
  return typeof raw.version === 'string' ? raw.version : '0.0.0';
}
