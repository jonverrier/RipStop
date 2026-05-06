/**
 * @module ConfigHash
 * Deterministic SHA-256 over resolved Ripstop configuration for RIPSTOP.md freshness.
 */
// Copyright (c) 2026 Jon Verrier

import * as crypto from 'crypto';
import { IRipstopConfig } from './schema';

/**
 * Serialises a value with sorted object keys for stable hashing.
 * @param value - JSON-serialisable value.
 * @returns Canonical string form.
 */
export function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  const primitive = typeof value;
  if (primitive === 'number' || primitive === 'boolean' || primitive === 'string') {
    return JSON.stringify(value);
  }
  if (primitive === 'bigint') {
    return JSON.stringify((value as bigint).toString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry as unknown)).join(',')}]`;
  }
  if (primitive === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map((key) => {
      const entry = record[key];
      if (entry === undefined) {
        return `${JSON.stringify(key)}:null`;
      }
      return `${JSON.stringify(key)}:${stableStringify(entry)}`;
    });
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(String(value));
}

/**
 * Computes SHA-256 hex digest of the resolved config (post-merge, post-parse).
 * @param config - Validated Ripstop configuration.
 * @returns 64-character lowercase hex digest.
 */
export function hashResolvedRipstopConfig(config: IRipstopConfig): string {
  return crypto.createHash('sha256').update(stableStringify(config), 'utf8').digest('hex');
}
