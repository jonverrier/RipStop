/**
 * @module CheckRegistry
 * Built-in check registry and trigger validation.
 */
// Copyright (c) 2026 Jon Verrier

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
