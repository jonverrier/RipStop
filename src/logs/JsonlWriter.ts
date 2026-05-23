/**
 * @module JsonlWriter
 * Append-only JSONL writer used by Ripstop runtime logs.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// This module provides a small append-only writer for JSON Lines (JSONL) log files. It is intended for runtime logging where each event is stored as a single JSON object per line, making the output easy to stream, tail, and parse incrementally.
// 
// The main export is the JsonlWriter class. You create an instance with a target file path. Its append method takes a plain object record and writes it as one JSONL record by serializing the object to JSON and adding a trailing newline. Before writing, it ensures the parent directory exists, so callers do not need to pre-create log directories.
// 
// The implementation relies on Node’s fs/promises module for async filesystem operations. It uses mkdir with the recursive option to create missing directories and appendFile to add new records without truncating existing data. It also uses the path module to compute the directory name from the provided file path.
// ===End StrongAI Generated Comment===


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
