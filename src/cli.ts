#!/usr/bin/env node
/**
 * @module Cli
 * Ripstop command-line entry point.
 */
// Copyright (c) 2026 Jon Verrier

import * as process from 'process';
import { InvalidParameterError, InvalidStateError } from '@jonverrier/assistant-common';
import { CHECK_MODES, CheckMode, IPushPayload, Trigger, TRIGGERS } from './checks/types';
import { createDefaultRegistry } from './checks/registry';
import { parsePrePushInput } from './checks/HistoryGuard';
import { loadConfig } from './config/load';
import { FileSelection, Git } from './git/Git';
import { IGenerateMdCommand, parseGenerateMdArgs, runGenerateMd } from './generateMd';
import { IRecoverCommand, parseRecoverArgs, runRecoverConfigHistory } from './recover';
import { createReporter } from './reporters/Reporter';
import { runChecks } from './Runner';

interface ICheckCommand {
  command: 'check';
  configPath: string;
  selection: FileSelection;
  trigger: Trigger;
  requestedChecks: string[];
  modeOverride?: CheckMode;
  format?: 'human' | 'json';
  commitMsgFile?: string;
  remote?: string;
}

interface IListCommand {
  command: 'list';
}

interface IExplainCommand {
  command: 'explain';
  check: string;
  resolved: boolean;
  configPath: string;
}

interface IVersionCommand {
  command: 'version';
}

type Command = ICheckCommand | IListCommand | IExplainCommand | IVersionCommand | IGenerateMdCommand | IRecoverCommand;

const HELP_TEXT = `Ripstop guardrails

Usage:
  ripstop check [--staged | --all | --diff <ref>] --trigger <trigger> [options]
  ripstop generate-md [options]
  ripstop recover --config-history [--since <iso>] [--config <path>]
  ripstop list
  ripstop explain <check> [--resolved]
  ripstop version

generate-md options:
  --config <path>           Guardrails file (default: .guardrails.yaml)
  --output <path>           Output file (default: RIPSTOP.md)
  --format <fmt>            markdown | claude | cursor | codex | q (default: markdown)
  --check-fresh             Exit 1 if RIPSTOP.md is missing or stale (no write)
  --dry-run                 Print generated markdown to stdout; do not write
  (With --format claude, also writes .claude/settings.ripstop.json when not dry-run.)

recover options:
  --config-history          Required; print reflog-witness snapshots from witness log
  --since <iso8601>         Only entries at or after this timestamp
  --config <path>           Guardrails file (default: .guardrails.yaml)

Check options:
  --config <path>           Config file path (default: .guardrails.yaml)
  --check <name>            Run only a named check (repeatable)
  --mode <mode>             Override mode: enforce | warn | off
  --format <format>         Output format: human | json
  --commit-msg-file <path>  Commit message file from commit-msg hook
  --remote <name>           Remote name from pre-push hook
  --help                    Show this help
`;

/**
 * Parses CLI arguments.
 * @param argv - Arguments after executable name.
 * @returns Parsed command.
 */
export function parseArgs(argv: string[]): Command {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(HELP_TEXT);
    process.exit(0);
  }

  if (command === 'list') {
    return { command: 'list' };
  }

  if (command === 'version') {
    return { command: 'version' };
  }

  if (command === 'explain') {
    return parseExplain(rest);
  }

  if (command === 'check') {
    return parseCheck(rest);
  }

  if (command === 'generate-md') {
    return parseGenerateMdArgs(rest);
  }

  if (command === 'recover') {
    return parseRecoverArgs(rest);
  }

  throw new InvalidParameterError(`Unknown command: ${command}`);
}

async function main(): Promise<void> {
  const command = parseArgs(process.argv.slice(2));
  const registry = createDefaultRegistry();

  if (command.command === 'version') {
    process.stdout.write('0.2.0\n');
    return;
  }

  if (command.command === 'list') {
    for (const check of registry.list()) {
      process.stdout.write(`${check.name}\t${check.supportedTriggers.join(',')}\t${check.description}\n`);
    }
    return;
  }

  const git = new Git(process.cwd());
  const repoRoot = await git.repoRoot();

  if (command.command === 'explain') {
    const check = registry.get(command.check);
    process.stdout.write(`${check.name}\n${check.description}\nTriggers: ${check.supportedTriggers.join(', ')}\n`);
    if (command.resolved) {
      const config = await loadConfig(repoRoot, command.configPath);
      process.stdout.write(`${JSON.stringify(config.checks[check.name] ?? {}, null, 2)}\n`);
    }
    return;
  }

  if (command.command === 'generate-md') {
    const exitCode = await runGenerateMd(repoRoot, command);
    process.exit(exitCode);
  }

  if (command.command === 'recover') {
    await runRecoverConfigHistory(repoRoot, command);
    return;
  }

  const checkCommand = command;
  const config = await loadConfig(repoRoot, checkCommand.configPath);
  const commitMessage = await git.readCommitMessage(checkCommand.commitMsgFile);
  const pushPayload = checkCommand.trigger === 'pre-push'
    ? await readPushPayload(checkCommand.remote ?? 'origin')
    : undefined;

  const result = await runChecks(config, registry, git, {
    repoRoot,
    trigger: checkCommand.trigger,
    selection: checkCommand.selection,
    requestedChecks: checkCommand.requestedChecks,
    modeOverride: checkCommand.modeOverride,
    commitMessage,
    pushPayload,
    guardrailsConfigPath: checkCommand.configPath
  });

  const reporter = createReporter(checkCommand.format ?? config.reporting.format);
  reporter.write(result);
  if (result.enforcedFailures > 0) {
    process.exit(1);
  }
}

function parseCheck(args: string[]): ICheckCommand {
  let configPath = '.guardrails.yaml';
  let selection: FileSelection | undefined;
  let trigger: Trigger | undefined;
  const requestedChecks: string[] = [];
  let modeOverride: CheckMode | undefined;
  let format: 'human' | 'json' | undefined;
  let commitMsgFile: string | undefined;
  let remote: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--config':
        configPath = requireValue(args, ++i, '--config');
        break;
      case '--staged':
        selection = { kind: 'staged' };
        break;
      case '--all':
        selection = { kind: 'all' };
        break;
      case '--diff':
        selection = { kind: 'diff', ref: requireValue(args, ++i, '--diff') };
        break;
      case '--trigger':
        trigger = parseTrigger(requireValue(args, ++i, '--trigger'));
        break;
      case '--check':
        requestedChecks.push(requireValue(args, ++i, '--check'));
        break;
      case '--mode':
        modeOverride = parseMode(requireValue(args, ++i, '--mode'));
        break;
      case '--format':
        format = parseFormat(requireValue(args, ++i, '--format'));
        break;
      case '--commit-msg-file':
        commitMsgFile = requireValue(args, ++i, '--commit-msg-file');
        break;
      case '--remote':
        remote = requireValue(args, ++i, '--remote');
        break;
      default:
        throw new InvalidParameterError(`Unknown check option: ${arg}`);
    }
  }

  if (!trigger) {
    throw new InvalidParameterError('--trigger is required');
  }

  return {
    command: 'check',
    configPath,
    selection: selection ?? defaultSelection(trigger),
    trigger,
    requestedChecks,
    modeOverride,
    format,
    commitMsgFile,
    remote
  };
}

function parseExplain(args: string[]): IExplainCommand {
  const check = args[0];
  if (!check || check.startsWith('--')) {
    throw new InvalidParameterError('explain requires a check name');
  }

  let resolved = false;
  let configPath = '.guardrails.yaml';
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--resolved') {
      resolved = true;
    } else if (args[i] === '--config') {
      configPath = requireValue(args, ++i, '--config');
    } else {
      throw new InvalidParameterError(`Unknown explain option: ${args[i]}`);
    }
  }

  return { command: 'explain', check, resolved, configPath };
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new InvalidParameterError(`${flag} requires a value`);
  }
  return value;
}

function parseTrigger(value: string): Trigger {
  if (TRIGGERS.includes(value as Trigger)) {
    return value as Trigger;
  }
  throw new InvalidParameterError(`Invalid trigger: ${value}`);
}

function parseMode(value: string): CheckMode {
  if (CHECK_MODES.includes(value as CheckMode)) {
    return value as CheckMode;
  }
  throw new InvalidParameterError(`Invalid mode: ${value}`);
}

function parseFormat(value: string): 'human' | 'json' {
  if (value === 'human' || value === 'json') {
    return value;
  }
  throw new InvalidParameterError(`Invalid format: ${value}`);
}

function defaultSelection(trigger: Trigger): FileSelection {
  return trigger === 'ci' ? { kind: 'all' } : { kind: 'staged' };
}

async function readPushPayload(remote: string): Promise<IPushPayload> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const input = Buffer.concat(chunks).toString('utf8');
  return {
    remote,
    refs: parsePrePushInput(remote, input)
  };
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Ripstop failed: ${message}\n`);
    if (error instanceof InvalidParameterError || error instanceof InvalidStateError) {
      process.exit(2);
    }
    process.exit(3);
  });
}
