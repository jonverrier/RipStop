/**
 * @module Ripstop
 * Public exports for the Ripstop guardrails package.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module is the public entry point for the Ripstop guardrails package. It re-exports the core configuration, check definition, registry, and execution APIs so consumers can import everything from one place.
// 
// For configuration, it exports loadConfig to read and normalize Ripstop settings, and deepMerge to combine configuration objects. It also exports RipstopConfigSchema and BaseCheckConfigSchema plus the IRipstopConfig and IBaseCheckConfig types, which define and validate the expected config shape.
// 
// For authoring and organizing checks, it exports CheckRegistry and createDefaultRegistry, along with the main types used by checks: ICheck, ICheckContext, IFileEntry, IFinding, IPushPayload, Trigger, and CheckMode. It also exposes the TRIGGERS and CHECK_MODES constants for supported values.
// 
// For running checks, it exports runChecks and the IRunOptions and IRunResult types from the Runner module.
// 
// All functionality is implemented in the imported submodules under ./config, ./checks, and ./Runner; this file only aggregates and re-exports them.
// ===End StrongAI Generated Comment===


export { loadConfig, deepMerge } from './config/load';
export { RipstopConfigSchema, BaseCheckConfigSchema } from './config/schema';
export type { IRipstopConfig, IBaseCheckConfig } from './config/schema';
export { CheckRegistry, createDefaultRegistry } from './checks/registry';
export type { ICheck, ICheckContext, IFileEntry, IFinding, IPushPayload, Trigger, CheckMode } from './checks/types';
export { TRIGGERS, CHECK_MODES } from './checks/types';
export { runChecks } from './Runner';
export type { IRunOptions, IRunResult } from './Runner';
