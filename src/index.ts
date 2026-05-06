/**
 * @module Ripstop
 * Public exports for the Ripstop guardrails package.
 */
// Copyright (c) 2026 Jon Verrier

export { loadConfig, deepMerge } from './config/load';
export { RipstopConfigSchema, BaseCheckConfigSchema } from './config/schema';
export type { IRipstopConfig, IBaseCheckConfig } from './config/schema';
export { CheckRegistry, createDefaultRegistry } from './checks/registry';
export type { ICheck, ICheckContext, IFileEntry, IFinding, IPushPayload, Trigger, CheckMode } from './checks/types';
export { TRIGGERS, CHECK_MODES } from './checks/types';
export { runChecks } from './Runner';
export type { IRunOptions, IRunResult } from './Runner';
