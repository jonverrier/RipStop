/**
 * @module WitnessWriter
 * Structured witness log writer for recovery-oriented Git state.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module provides a structured “witness” log writer intended for recovery-oriented Git state tracking. It records events as JSON Lines so that tools can replay or inspect state changes over time with consistent metadata.
// 
// The main export is the WitnessWriter class. Construct it with a target file path, a version string, and a repository name. The instance keeps these values and uses them to enrich every log entry.
// 
// WitnessWriter.append takes an arbitrary record object and appends it to the log. It automatically adds a timestamp in ISO 8601 format, the provided version, and the repository name, then merges the caller’s record fields on top. The method is asynchronous and resolves when the entry has been written.
// 
// The module depends on JsonlWriter from ./JsonlWriter for the underlying file handling and JSONL formatting. JsonlWriter is responsible for appending serialized objects to the file; WitnessWriter focuses on consistent metadata and a simple API.
// ===End StrongAI Generated Comment===


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
