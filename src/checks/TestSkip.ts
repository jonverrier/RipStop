/**
 * @module TestSkip
 * Detects newly introduced test skip annotations in diffs.
 */
// Copyright (c) 2026 Jon Verrier

import { z } from 'zod';
import { ICheck, ICheckContext, IFinding } from './types';

const DEFAULT_BLOCKED_ANNOTATIONS = ['.skip(', 'xit(', 'it.skip(', 'describe.skip(', '@skip', '@Disabled'];
const DEFAULT_TICKET_PATTERN = '\\b[A-Z]+-\\d+\\b';

const TestSkipConfigSchema = z.object({
  blocked_annotations: z.array(z.string()).default(DEFAULT_BLOCKED_ANNOTATIONS),
  require_ticket: z.boolean().default(true),
  ticket_pattern: z.string().default(DEFAULT_TICKET_PATTERN)
}).passthrough();

export const testSkipCheck: ICheck = {
  name: 'test-skip',
  description: 'Detects newly introduced test skip annotations.',
  supportedTriggers: ['pre-commit', 'ci'],
  configSchema: TestSkipConfigSchema,
  async run(ctx: ICheckContext): Promise<IFinding[]> {
    const config = TestSkipConfigSchema.parse(ctx.config);
    const ticketRegex = compileTicketRegex(config.ticket_pattern);
    const findings: IFinding[] = [];

    for (const file of ctx.files) {
      if (!file.diff || file.isDeleted) {
        continue;
      }

      const diff = await file.diff();
      const addedLines = diff.split(/\r?\n/).filter((line) => line.startsWith('+') && !line.startsWith('+++'));
      for (let index = 0; index < addedLines.length; index++) {
        const addedLine = addedLines[index].slice(1);
        const blocked = config.blocked_annotations.find((annotation) => addedLine.includes(annotation));
        if (!blocked) {
          continue;
        }

        const previousAddedLine = index > 0 ? addedLines[index - 1].slice(1) : '';
        const ticketPresent = ticketRegex.test(addedLine) || ticketRegex.test(previousAddedLine);
        if (config.require_ticket && !ticketPresent) {
          findings.push({
            check: 'test-skip',
            severity: ctx.mode === 'enforce' ? 'error' : 'warning',
            file: file.path,
            message: `New test skip annotation "${blocked}" requires a ticket reference.`,
            ruleId: 'test-skip.ticket-required'
          });
        }
      }
    }

    return findings;
  }
};

function compileTicketRegex(pattern: string): RegExp {
  return new RegExp(pattern);
}
