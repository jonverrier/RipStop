/**
 * @module Git
 * Small Git command adapter used by Ripstop checks.
 */
// Copyright (c) 2026 Jon Verrier

import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { InvalidOperationError } from '@jonverrier/assistant-common';
import { IFileEntry } from '../checks/types';

const execFile = promisify(childProcess.execFile);
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export type FileSelection =
  | { kind: 'staged' }
  | { kind: 'all' }
  | { kind: 'diff'; ref: string };

export class Git {
  public constructor(private readonly cwd: string) {}

  /**
   * Finds the repository root for the current working directory.
   * @returns Absolute repository root.
   */
  public async repoRoot(): Promise<string> {
    const output = await this.run(['rev-parse', '--show-toplevel']);
    return output.trim();
  }

  /**
   * Builds file entries for the selected file set.
   * @param repoRoot - Repository root.
   * @param selection - File selection.
   * @returns File entries.
   */
  public async files(repoRoot: string, selection: FileSelection): Promise<IFileEntry[]> {
    if (selection.kind === 'all') {
      const output = await this.run(['ls-files'], repoRoot);
      return output.split('\n').filter(Boolean).map((filePath) => this.createWorktreeEntry(repoRoot, filePath, false, false));
    }

    const nameStatusArgs = selection.kind === 'staged'
      ? ['diff', '--cached', '--name-status']
      : ['diff', '--name-status', `${selection.ref}...HEAD`];

    const nameStatus = await this.run(nameStatusArgs, repoRoot);
    const entries = nameStatus.split('\n').filter(Boolean).map((line) => parseNameStatus(line));

    return entries.map((entry) => {
      if (selection.kind === 'staged') {
        return this.createStagedEntry(repoRoot, entry.path, entry.status);
      }
      return this.createDiffEntry(repoRoot, entry.path, entry.status, selection.ref);
    });
  }

  /**
   * Reads a commit message file.
   * @param commitMsgFile - File path from the commit-msg hook.
   * @returns Commit message.
   */
  public async readCommitMessage(commitMsgFile?: string): Promise<string | undefined> {
    if (!commitMsgFile) {
      return undefined;
    }
    return fs.readFile(commitMsgFile, 'utf8');
  }

  private createWorktreeEntry(repoRoot: string, filePath: string, isNew: boolean, isDeleted: boolean): IFileEntry {
    return {
      path: filePath,
      isNew,
      isDeleted,
      content: async () => isDeleted ? '' : fs.readFile(path.join(repoRoot, filePath), 'utf8')
    };
  }

  private createStagedEntry(repoRoot: string, filePath: string, status: string): IFileEntry {
    const isDeleted = status.startsWith('D');
    const isNew = status.startsWith('A');
    return {
      path: filePath,
      isNew,
      isDeleted,
      content: async () => isDeleted ? '' : this.run(['show', `:${filePath}`], repoRoot),
      diff: async () => this.run(['diff', '--cached', '--', filePath], repoRoot)
    };
  }

  private createDiffEntry(repoRoot: string, filePath: string, status: string, ref: string): IFileEntry {
    const isDeleted = status.startsWith('D');
    const isNew = status.startsWith('A');
    return {
      path: filePath,
      isNew,
      isDeleted,
      content: async () => isDeleted ? '' : fs.readFile(path.join(repoRoot, filePath), 'utf8'),
      diff: async () => this.run(['diff', `${ref === EMPTY_TREE_SHA ? ref : `${ref}...HEAD`}`, '--', filePath], repoRoot)
    };
  }

  private async run(args: string[], cwd: string = this.cwd): Promise<string> {
    try {
      const result = await execFile('git', args, { cwd });
      return result.stdout;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InvalidOperationError(`Git command failed: git ${args.join(' ')}. ${message}`);
    }
  }
}

function parseNameStatus(line: string): { status: string; path: string } {
  const parts = line.split('\t');
  const status = parts[0] ?? '';
  const filePath = parts[parts.length - 1] ?? '';
  return { status, path: filePath };
}
