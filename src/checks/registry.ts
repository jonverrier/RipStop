/**
 * @module CheckRegistry
 * Built-in check registry and trigger validation.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module provides a simple registry for “checks” and logic to pick which checks should run for a given trigger. It defines a built-in set of checks and exposes a registry that can also be constructed with a custom list.
// 
// CheckRegistry is the main export. It stores checks keyed by their unique name in a Map for fast lookup. list() returns all registered checks sorted by name. get(name) returns a specific check and throws an InvalidParameterError when the name is not registered, making configuration errors explicit. select(trigger, requestedChecks) returns only the checks that declare support for the provided Trigger. If requestedChecks is provided, it resolves those names first (and validates them via get); otherwise it considers all registered checks.
// 
// createDefaultRegistry() is a convenience factory that returns a CheckRegistry preloaded with the built-in checks.
// 
// The module relies on the ICheck and Trigger types plus the imported built-in check implementations (pii, path guard, test skip, history guard, ripstop-md freshness, and reflog witness).
// ===End StrongAI Generated Comment===


import { InvalidParameterError } from '@jonverrier/assistant-common';
import { ICheck, Trigger } from './types';
import { historyGuardCheck } from './HistoryGuard';
import { pathGuardCheck } from './PathGuard';
import { piiCheck } from './Pii';
import { reflogWitnessCheck } from './ReflogWitness';
import { ripstopMdFreshCheck } from './RipstopMdFresh';
import { testSkipCheck } from './TestSkip';

const BUILT_IN_CHECKS: ICheck[] = [
  piiCheck,
  pathGuardCheck,
  testSkipCheck,
  historyGuardCheck,
  ripstopMdFreshCheck,
  reflogWitnessCheck
];

export class CheckRegistry {
  private readonly checksByName: Map<string, ICheck>;

  public constructor(checks: ICheck[] = BUILT_IN_CHECKS) {
    this.checksByName = new Map(checks.map((check) => [check.name, check]));
  }

  /**
   * Lists all registered checks.
   * @returns Checks sorted by name.
   */
  public list(): ICheck[] {
    return [...this.checksByName.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  /**
   * Gets a named check.
   * @param name - Check name.
   * @returns Check implementation.
   */
  public get(name: string): ICheck {
    const check = this.checksByName.get(name);
    if (!check) {
      throw new InvalidParameterError(`Unknown check: ${name}`);
    }
    return check;
  }

  /**
   * Selects checks configured for a trigger.
   * @param trigger - Active trigger.
   * @param requestedChecks - Optional specific check names.
   * @returns Checks that support the trigger.
   */
  public select(trigger: Trigger, requestedChecks: string[] = []): ICheck[] {
    const checks = requestedChecks.length > 0 ? requestedChecks.map((name) => this.get(name)) : this.list();
    return checks.filter((check) => check.supportedTriggers.includes(trigger));
  }
}

export function createDefaultRegistry(): CheckRegistry {
  return new CheckRegistry();
}
