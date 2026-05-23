/**
 * @module HumanReporter
 * Human-readable terminal reporter.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// HumanReporter provides a human-readable terminal reporter for Ripstop check runs. Its job is to turn a run report into concise, line-oriented text written to standard output, suitable for local use or CI logs.
// 
// The module exports a single class, HumanReporter, which implements the IReporter interface. The class exposes one method, write(report), that prints a success message when there are no findings. When findings exist, it prints one block per finding. Each block includes the finding severity (uppercased), the check name, and a location string derived from the file and optional line number, or “repository” when no file is present. It then prints the finding message and the associated rule identifier. After listing all findings, it prints a summary line showing the number of enforced failures and warnings.
// 
// HumanReporter depends on the Reporter module’s IReporter and IRunReport types to define the required shape of the input and the reporter contract.
// ===End StrongAI Generated Comment===


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
