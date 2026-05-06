/**
 * @module Reporter
 * Reporter interface and factory for Ripstop CLI output.
 */
// Copyright (c) 2026 Jon Verrier

import { IFinding } from '../checks/types';
import { HumanReporter } from './human';
import { JsonReporter } from './json';

export interface IRunReport {
  findings: IFinding[];
  enforcedFailures: number;
  warnings: number;
}

export interface IReporter {
  write(report: IRunReport): void;
}

/**
 * Creates a reporter for the requested output format.
 * @param format - Output format.
 * @returns Reporter instance.
 */
export function createReporter(format: 'human' | 'json'): IReporter {
  return format === 'json' ? new JsonReporter() : new HumanReporter();
}
