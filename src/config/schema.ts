/**
 * @module ConfigSchema
 * Zod schemas for Ripstop YAML configuration.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// Defines Zod schemas used to validate and normalize Ripstop YAML configuration files. It centralizes defaults and basic shape checks so consumers can parse config safely and consistently.
// 
// RepoTierSchema constrains repository tier to 1, 2, or 3, and RepoTier is the inferred TypeScript type. CheckModeSchema and TriggerSchema are enums derived from imported CHECK_MODES and TRIGGERS, ensuring config values match the supported check modes and trigger names.
// 
// BaseCheckConfigSchema describes per-check configuration. It supports a mode (defaulting to "warn"), optional triggers, and optional exemptions. Each exemption requires a non-empty path and reason, and can optionally list specific positive integer line numbers. The schema is passthrough, allowing additional check-specific keys.
// 
// RipstopConfigSchema is the top-level config schema. It validates repo metadata, optional extends, plugin list, local_checks settings, a checks map keyed by check name, reporting output options, and bypass rules including trailers and optional per-rule trailer overrides. IRipstopConfig and IBaseCheckConfig are inferred types for consumers.
// ===End StrongAI Generated Comment===


import { z } from 'zod';
import { CHECK_MODES, TRIGGERS } from '../checks/types';

export const RepoTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type RepoTier = z.infer<typeof RepoTierSchema>;

export const CheckModeSchema = z.enum(CHECK_MODES);
export const TriggerSchema = z.enum(TRIGGERS);

export const BaseCheckConfigSchema = z.object({
  mode: CheckModeSchema.default('warn'),
  triggers: z.array(TriggerSchema).optional(),
  exemptions: z.array(z.object({
    path: z.string().min(1),
    reason: z.string().min(1),
    lines: z.array(z.number().int().positive()).optional()
  })).optional()
}).passthrough();

export const RipstopConfigSchema = z.object({
  repo: z.object({
    name: z.string().min(1),
    domain: z.string().min(1),
    tier: RepoTierSchema
  }),
  extends: z.string().optional(),
  plugins: z.array(z.string().min(1)).default([]),
  local_checks: z.object({
    enabled: z.boolean().default(false),
    path: z.string().default('.guardrails/checks')
  }).default({ enabled: false, path: '.guardrails/checks' }),
  checks: z.record(z.string(), BaseCheckConfigSchema).default({}),
  reporting: z.object({
    format: z.enum(['human', 'json']).default('human'),
    audit_log: z.string().default('.git/ripstop/audit.jsonl'),
    witness_log: z.string().default('.git/ripstop/witness.jsonl')
  }).default({
    format: 'human',
    audit_log: '.git/ripstop/audit.jsonl',
    witness_log: '.git/ripstop/witness.jsonl'
  }),
  bypass: z.object({
    allowed: z.boolean().default(true),
    trailer: z.string().default('GUARDRAILS-BYPASS'),
    reason_trailer: z.string().default('GUARDRAILS-BYPASS-REASON'),
    requires_reason: z.boolean().default(true),
    rule_specific_trailers: z.record(z.string(), z.string()).default({})
  }).default({
    allowed: true,
    trailer: 'GUARDRAILS-BYPASS',
    reason_trailer: 'GUARDRAILS-BYPASS-REASON',
    requires_reason: true,
    rule_specific_trailers: {}
  })
});

export type IRipstopConfig = z.infer<typeof RipstopConfigSchema>;
export type IBaseCheckConfig = z.infer<typeof BaseCheckConfigSchema>;
