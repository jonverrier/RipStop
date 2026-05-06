/**
 * @module JsonlWriter
 * Append-only JSONL writer used by Ripstop runtime logs.
 */
// Copyright (c) 2026 Jon Verrier

import * as fs from 'fs/promises';
import * as path from 'path';

export class JsonlWriter {
  public constructor(private readonly filePath: string) {}

  /**
   * Appends a JSON object as one JSONL record.
   * @param record - Record to append.
   */
  public async append(record: Record<string, unknown>): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf8');
  }
}
