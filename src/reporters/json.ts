/**
 * @module JsonReporter
 * Machine-readable JSON reporter.
 */
// Copyright (c) 2026 Jon Verrier

import { IReporter, IRunReport } from './Reporter';

export class JsonReporter implements IReporter {
  /**
   * Writes a JSON report to stdout.
   * @param report - Check run report.
   */
  public write(report: IRunReport): void {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}
