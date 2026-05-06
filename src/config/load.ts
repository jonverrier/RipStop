/**
 * @module ConfigLoad
 * Loads and merges Ripstop YAML configuration and built-in presets.
 */
// Copyright (c) 2026 Jon Verrier

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { InvalidParameterError, InvalidStateError } from '@jonverrier/assistant-common';
import { IRipstopConfig, RipstopConfigSchema } from './schema';

const PRESET_PREFIX = '@jonverrier/ripstop/presets/';
const YAML_EXTENSIONS = ['.yaml', '.yml'];

type JsonObject = Record<string, unknown>;

/**
 * Loads a Ripstop config file and resolves any built-in preset inheritance.
 * @param repoRoot - Repository root containing the config file.
 * @param configPath - Config path, absolute or relative to repoRoot.
 * @returns Validated Ripstop config.
 */
export async function loadConfig(repoRoot: string, configPath: string = '.guardrails.yaml'): Promise<IRipstopConfig> {
  const resolvedConfigPath = path.isAbsolute(configPath) ? configPath : path.join(repoRoot, configPath);
  const repoConfig = await readYamlObject(resolvedConfigPath);
  const presetRef = typeof repoConfig.extends === 'string' ? repoConfig.extends : undefined;
  const presetConfig = presetRef ? await loadPreset(presetRef) : {};
  const merged = deepMerge(presetConfig, repoConfig);

  const parsed = RipstopConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new InvalidParameterError(`Invalid Ripstop config: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * Deep merges configuration objects. Arrays replace rather than concatenate.
 * @param base - Base object.
 * @param override - Override object.
 * @returns Merged object.
 */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }

  const output: JsonObject = { ...base };
  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = output[key];
    if (Array.isArray(overrideValue)) {
      output[key] = [...overrideValue];
    } else if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      output[key] = deepMerge(baseValue, overrideValue);
    } else {
      output[key] = overrideValue;
    }
  }
  return output;
}

async function loadPreset(presetRef: string): Promise<JsonObject> {
  if (!presetRef.startsWith(PRESET_PREFIX)) {
    throw new InvalidParameterError(`Unsupported preset reference "${presetRef}". Built-in presets must start with ${PRESET_PREFIX}`);
  }

  const presetName = presetRef.slice(PRESET_PREFIX.length);
  if (!presetName || presetName.includes('..') || path.isAbsolute(presetName)) {
    throw new InvalidParameterError(`Invalid preset name "${presetName}"`);
  }

  for (const extension of YAML_EXTENSIONS) {
    const candidate = path.join(__dirname, '..', 'presets', `${presetName}${extension}`);
    try {
      return await readYamlObject(candidate);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  throw new InvalidParameterError(`Preset not found: ${presetRef}`);
}

async function readYamlObject(filePath: string): Promise<JsonObject> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new InvalidStateError(`Ripstop config file not found: ${filePath}`);
    }
    throw error;
  }

  const parsed = yaml.load(raw);
  if (!isPlainObject(parsed)) {
    throw new InvalidParameterError(`YAML file must contain an object: ${filePath}`);
  }
  return parsed;
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
