/**
 * @module TestSkip
 * Detects newly introduced test skip annotations in diffs.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// Detects newly introduced test-skip annotations in code diffs and reports them as findings. The module exports a single check, testSkipCheck, which conforms to the ICheck interface and is intended to run in both pre-commit and CI triggers. On execution, it parses user configuration with a Zod schema that provides defaults for blocked annotation substrings (for example “it.skip(”, “describe.skip(”, “@skip”) and a ticket reference pattern. For each non-deleted file that exposes a diff, it scans only added diff lines and looks for any blocked annotation. If a blocked annotation is added and require_ticket is enabled, it requires a ticket ID match either on the same added line or the immediately preceding added line. Missing tickets produce an IFinding with severity based on ctx.mode (error in enforce mode, otherwise warning) and a stable ruleId. The helper compileTicketRegex turns the configured pattern into a RegExp. Key dependencies are zod for config validation and local types (ICheck, ICheckContext, IFinding) for integration.
// ===End StrongAI Generated Comment===


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
