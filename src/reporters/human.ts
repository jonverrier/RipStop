/**
 * @module HumanReporter
 * Human-readable terminal reporter.
 */
// Copyright (c) 2026 Jon Verrier

import { IReporter, IRunReport } from './Reporter';

export class HumanReporter implements IReporter {
  /**
   * Writes a human-readable report to stdout.
   * @param report - Check run report.
   */
  public write(report: IRunReport): void {
    if (report.findings.length === 0) {
      process.stdout.write('Ripstop: all configured checks passed.\n');
      return;
    }

    for (const finding of report.findings) {
      const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ''}` : 'repository';
      process.stdout.write(`${finding.severity.toUpperCase()} ${finding.check} ${location}\n`);
      process.stdout.write(`  ${finding.message}\n`);
      process.stdout.write(`  rule: ${finding.ruleId}\n`);
    }

    process.stdout.write(`\nRipstop: ${report.enforcedFailures} enforced failure(s), ${report.warnings} warning(s).\n`);
  }
}
