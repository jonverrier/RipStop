/**
 * @module ConfigSchema
 * Zod schemas for Ripstop YAML configuration.
 */
// Copyright (c) 2026 Jon Verrier

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
