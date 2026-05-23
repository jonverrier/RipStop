/**
 * @module JsonReporter
 * Machine-readable JSON reporter.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module provides a machine-readable reporter that outputs check results as JSON. It is intended for tooling and automation where another process needs to consume the run output reliably, rather than reading a human-formatted report.
// 
// The main export is JsonReporter, a class that implements the IReporter interface. JsonReporter exposes a single method, write(report), which takes an IRunReport object representing a completed check run. When called, it serializes the report to a JSON string using JSON.stringify with two-space indentation for readability and writes it to standard output. It always appends a trailing newline so the output is line-friendly in logs and pipes.
// 
// The module relies on the IReporter and IRunReport types imported from the local Reporter module to define the expected reporter contract and the shape of the data being emitted. It also depends on Node.js process.stdout for output.
// ===End StrongAI Generated Comment===


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
