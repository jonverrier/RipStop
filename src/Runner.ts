/**
 * @module Runner
 * Executes configured Ripstop checks for one CLI invocation.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// Executes Ripstop checks for a single CLI run. The module gathers the target file set from Git, selects the appropriate checks for a given trigger, runs them, and returns aggregated results. The main export is runChecks, which takes a resolved IRipstopConfig, a CheckRegistry, a Git adapter, and IRunOptions. It loads files via git.files, creates AuditWriter and WitnessWriter instances for runtime logging, then iterates the selected checks. For each check it parses per-check config with the check’s configSchema, determines the effective mode (override or config, defaulting to warn), optionally filters by configured triggers, and invokes check.run with commit and push context plus the resolved config and log writers. Each finding is appended to the audit log and included in the returned IRunResult, with counts for enforcedFailures (errors) and warnings. It relies on Node’s path for safe relative log paths and InvalidParameterError to reject absolute log destinations.
// ===End StrongAI Generated Comment===


import * as path from 'path';
import { InvalidParameterError } from '@jonverrier/assistant-common';
import { CheckMode, IFinding, IPushPayload, Trigger } from './checks/types';
import { CheckRegistry } from './checks/registry';
import { IRipstopConfig } from './config/schema';
import { AuditWriter } from './logs/AuditWriter';
import { WitnessWriter } from './logs/WitnessWriter';
import { FileSelection, Git } from './git/Git';

export interface IRunOptions {
  repoRoot: string;
  trigger: Trigger;
  selection: FileSelection;
  requestedChecks: string[];
  modeOverride?: CheckMode;
  commitMessage?: string;
  pushPayload?: IPushPayload;
  /** Path passed to `loadConfig` for this run (default `.guardrails.yaml`). */
  guardrailsConfigPath: string;
}

export interface IRunResult {
  findings: IFinding[];
  enforcedFailures: number;
  warnings: number;
}

/**
 * Runs checks against the selected files.
 * @param config - Resolved configuration.
 * @param registry - Check registry.
 * @param git - Git adapter.
 * @param options - Run options.
 * @returns Run result.
 */
export async function runChecks(config: IRipstopConfig, registry: CheckRegistry, git: Git, options: IRunOptions): Promise<IRunResult> {
  const files = await git.files(options.repoRoot, options.selection);
  const audit = new AuditWriter(resolveRuntimePath(options.repoRoot, config.reporting.audit_log), packageVersion(), config.repo.name);
  const witness = new WitnessWriter(resolveRuntimePath(options.repoRoot, config.reporting.witness_log), packageVersion(), config.repo.name);
  const findings: IFinding[] = [];

  const checks = registry.select(options.trigger, options.requestedChecks);
  for (const check of checks) {
    const rawConfig = config.checks[check.name] ?? {};
    const baseConfig = check.configSchema.parse(rawConfig);
    const mode = options.modeOverride ?? readMode(baseConfig);
    if (mode === 'off') {
      continue;
    }

    const configuredTriggers = readTriggers(baseConfig);
    if (configuredTriggers && !configuredTriggers.includes(options.trigger)) {
      continue;
    }

    const checkFindings = await check.run({
      repoRoot: options.repoRoot,
      trigger: options.trigger,
      files,
      commitMessage: options.commitMessage,
      pushPayload: options.pushPayload,
      config: baseConfig,
      mode,
      audit,
      witness,
      resolvedRipstopConfig: config,
      guardrailsConfigPath: options.guardrailsConfigPath
    });

    for (const finding of checkFindings) {
      findings.push(finding);
      await audit.append({
        type: 'finding',
        trigger: options.trigger,
        check: finding.check,
        ruleId: finding.ruleId,
        severity: finding.severity,
        file: finding.file,
        line: finding.line,
        message: finding.message
      });
    }
  }

  return {
    findings,
    enforcedFailures: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length
  };
}

function readMode(config: unknown): CheckMode {
  if (isRecord(config) && (config.mode === 'enforce' || config.mode === 'warn' || config.mode === 'off')) {
    return config.mode;
  }
  return 'warn';
}

function readTriggers(config: unknown): Trigger[] | undefined {
  if (!isRecord(config) || !Array.isArray(config.triggers)) {
    return undefined;
  }
  return config.triggers.filter((trigger): trigger is Trigger =>
    trigger === 'pre-commit' ||
    trigger === 'commit-msg' ||
    trigger === 'pre-push' ||
    trigger === 'pre-rebase' ||
    trigger === 'pre-action' ||
    trigger === 'ci'
  );
}

function resolveRuntimePath(repoRoot: string, configuredPath: string): string {
  if (path.isAbsolute(configuredPath)) {
    throw new InvalidParameterError('Runtime log paths must be relative to the repository root.');
  }
  return path.join(repoRoot, configuredPath);
}

function packageVersion(): string {
  return '0.2.0';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
