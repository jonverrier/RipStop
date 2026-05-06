/**
 * @module WitnessWriter
 * Structured witness log writer for recovery-oriented Git state.
 */
// Copyright (c) 2026 Jon Verrier

import { JsonlWriter } from './JsonlWriter';

export class WitnessWriter {
  private readonly writer: JsonlWriter;

  public constructor(filePath: string, private readonly version: string, private readonly repoName: string) {
    this.writer = new JsonlWriter(filePath);
  }

  /**
   * Appends witness data with package metadata.
   * @param record - Recovery-oriented record.
   */
  public async append(record: Record<string, unknown>): Promise<void> {
    await this.writer.append({
      timestamp: new Date().toISOString(),
      version: this.version,
      repo: this.repoName,
      ...record
    });
  }
}
