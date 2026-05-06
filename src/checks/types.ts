/**
 * @module CheckTypes
 * Shared contracts for Ripstop guardrail checks.
 */
// Copyright (c) 2026 Jon Verrier

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
}

export interface ICheck {
  name: string;
  description: string;
  supportedTriggers: Trigger[];
  configSchema: z.ZodSchema;
  run(ctx: ICheckContext): Promise<IFinding[]>;
}
