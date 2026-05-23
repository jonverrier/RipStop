/**
 * @module CheckTypes
 * Shared contracts for Ripstop guardrail checks.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// Defines the shared contracts used by Ripstop guardrail checks. It centralizes the types that describe when checks run, how they are configured, what inputs they receive, and what findings they report. TRIGGERS and Trigger enumerate supported execution contexts such as pre-commit, pre-push, and CI. CHECK_MODES and CheckMode control behavior (enforce, warn, off). FINDING_SEVERITIES and FindingSeverity standardize finding importance. IPushPayload and IPushPayloadRef model push metadata for server-like hooks. IFileEntry represents a file under evaluation, including async access to content and optional diff, plus flags for new/deleted status. IFinding is the normalized output from a check, including check name, severity, optional file/line, message, ruleId, and extra context. ICheckContext describes the full runtime environment passed to checks, including repo root, trigger, files, optional commit message and push payload, raw and resolved configuration, guardrails config path, and audit/witness log writers. ICheck defines the check plugin shape, including a Zod config schema and an async run method. Dependencies: zod for schema typing/validation, plus AuditWriter and WitnessWriter for structured logging.
// ===End StrongAI Generated Comment===


import { z } from 'zod';
import { AuditWriter } from '../logs/AuditWriter';
import { WitnessWriter } from '../logs/WitnessWriter';

export const TRIGGERS = ['pre-commit', 'commit-msg', 'pre-push', 'pre-rebase', 'pre-action', 'ci'] as const;
export type Trigger = typeof TRIGGERS[number];

export const CHECK_MODES = ['enforce', 'warn', 'off'] as const;
export type CheckMode = typeof CHECK_MODES[number];

export const FINDING_SEVERITIES = ['error', 'warning', 'info'] as const;
export type FindingSeverity = typeof FINDING_SEVERITIES[number];

export interface IPushPayloadRef {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
  isForceUpdate: boolean;
  isDelete: boolean;
}

export interface IPushPayload {
  refs: IPushPayloadRef[];
  remote: string;
}

export interface IFileEntry {
  path: string;
  content: () => Promise<string>;
  diff?: () => Promise<string>;
  isNew: boolean;
  isDeleted: boolean;
}

export interface IFinding {
  check: string;
  severity: FindingSeverity;
  file?: string;
  line?: number;
  message: string;
  ruleId: string;
  context?: Record<string, unknown>;
}

export interface ICheckContext {
  repoRoot: string;
  trigger: Trigger;
  files: IFileEntry[];
  commitMessage?: string;
  pushPayload?: IPushPayload;
  config: unknown;
  mode: CheckMode;
  audit: AuditWriter;
  witness: WitnessWriter;
  /** Merged Ripstop configuration produced by `loadConfig` for this run. */
  resolvedRipstopConfig: unknown;
  /** Path to the guardrails file for this run (repo-relative or absolute). */
  guardrailsConfigPath: string;
}

export interface ICheck {
  name: string;
  description: string;
  supportedTriggers: Trigger[];
  configSchema: z.ZodSchema;
  run(ctx: ICheckContext): Promise<IFinding[]>;
}
