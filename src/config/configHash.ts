/**
 * @module ConfigHash
 * Deterministic SHA-256 over resolved Ripstop configuration for RIPSTOP.md freshness.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module produces a deterministic SHA-256 hash for a fully resolved Ripstop configuration, intended for checking RIPSTOP.md freshness. It focuses on stable, repeatable hashing by converting the config into a canonical string form before hashing.
// 
// stableStringify(value) serialises any JSON-like value into a consistent string. It handles null, numbers, booleans, strings, bigints, arrays, and objects. Arrays preserve element order. Objects are emitted with keys sorted lexicographically to avoid hash changes from key insertion order. Undefined object properties are normalised to null so missing versus undefined does not cause unstable output. Non-JSON primitive types are coerced to strings.
// 
// hashResolvedRipstopConfig(config) computes the lowercase hex SHA-256 digest of the canonical serialisation of an IRipstopConfig object. It uses Node’s crypto module for hashing and relies on the IRipstopConfig type from the local schema module to ensure the input represents a validated, post-merge configuration.
// ===End StrongAI Generated Comment===


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
