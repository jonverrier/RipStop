/**
 * @module AuditWriter
 * Structured audit log writer for guardrail findings and bypasses.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module provides a structured audit log writer for recording guardrail activity such as findings, bypasses, exemptions, and mode changes. It standardizes the shape of audit events and ensures each entry includes consistent metadata about when it happened and which package and repository produced it.
// 
// The IAuditRecord interface defines the JSON record format written to the log. It includes required fields like timestamp, type, version, repo, and trigger, plus optional context fields such as check, ruleId, severity, file, line, message, and reason.
// 
// The AuditWriter class is the main utility. It is constructed with an output file path, a version string, and a repository name. Its append method accepts an audit record without timestamp, version, or repo, then fills those fields automatically and writes the final record.
// 
// The module relies on JsonlWriter for the underlying persistence, appending each record as a JSON Lines entry to the target file.
// ===End StrongAI Generated Comment===


import { JsonlWriter } from './JsonlWriter';

export interface IAuditRecord {
  timestamp: string;
  type: 'finding' | 'bypass' | 'exemption' | 'mode-change';
  version: string;
  repo: string;
  trigger: string;
  check?: string;
  ruleId?: string;
  severity?: string;
  file?: string;
  line?: number;
  message?: string;
  reason?: string;
}

export class AuditWriter {
  private readonly writer: JsonlWriter;

  public constructor(filePath: string, private readonly version: string, private readonly repoName: string) {
    this.writer = new JsonlWriter(filePath);
  }

  /**
   * Appends an audit record with package metadata.
   * @param record - Partial audit record.
   */
  public async append(record: Omit<IAuditRecord, 'timestamp' | 'version' | 'repo'>): Promise<void> {
    await this.writer.append({
      timestamp: new Date().toISOString(),
      version: this.version,
      repo: this.repoName,
      ...record
    });
  }
}
