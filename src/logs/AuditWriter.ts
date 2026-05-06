/**
 * @module AuditWriter
 * Structured audit log writer for guardrail findings and bypasses.
 */
// Copyright (c) 2026 Jon Verrier

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
