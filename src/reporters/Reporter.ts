/**
 * @module Reporter
 * Reporter interface and factory for Ripstop CLI output.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module defines the reporting layer for Ripstop CLI runs. It standardizes the shape of a run summary and provides a small factory to choose an output implementation. IRunReport describes the data a check run produces: a list of findings plus counts for enforced failures and warnings. IReporter is the common contract that all reporters must implement, with a single write method that renders an IRunReport to the desired destination (typically stdout). createReporter is the main entry point. It takes a format selector ('human' or 'json') and returns an IReporter instance that matches that format, defaulting to the human-friendly reporter when the format is not json. The module depends on IFinding from the checks type definitions to ensure findings are typed consistently across the system. It also relies on HumanReporter and JsonReporter implementations, which encapsulate the actual formatting and output behavior for their respective formats.
// ===End StrongAI Generated Comment===


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
