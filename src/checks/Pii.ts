/**
 * @module Pii
 * Regex-based PII detection for source files.
 */
// Copyright (c) 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260523)===
// Regex-based PII scanning check for source files during pre-commit and CI runs. The module defines a small set of default patterns (currently email addresses and UK mobile numbers) and reports any matching lines as findings.
// 
// The main export is piiCheck, an ICheck implementation. It exposes metadata (name, description, supportedTriggers) and a configSchema, then runs an async scan over ctx.files. For each non-deleted file, it skips paths covered by configured exemptions, reads file content, splits it into lines, and tests each line against each configured regex. When a match is found, it emits an IFinding with file path, 1-based line number, a ruleId of the form pii.<patternName>, and a severity that is error in enforce mode and warning otherwise.
// 
// It relies on zod to validate and default the configuration (patterns, extra_patterns, exemptions) and on picomatch to turn exemption path globs into matchers. It uses shared types (ICheck, ICheckContext, IFinding) from the local types module.
// ===End StrongAI Generated Comment===


import picomatch from 'picomatch';
import { z } from 'zod';
import { ICheck, ICheckContext, IFinding } from './types';

const DEFAULT_PATTERNS = [
  {
    name: 'email',
    pattern: '\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b',
    message: 'Email addresses must not appear in source files.'
  },
  {
    name: 'uk-mobile',
    pattern: '\\b(?:\\+?44|0)7\\d{9}\\b',
    message: 'UK mobile numbers must not appear in source files.'
  }
];

const PiiPatternSchema = z.object({
  name: z.string().min(1),
  pattern: z.string().min(1),
  message: z.string().min(1)
});

const PiiConfigSchema = z.object({
  patterns: z.array(PiiPatternSchema).default(DEFAULT_PATTERNS),
  extra_patterns: z.array(PiiPatternSchema).default([]),
  exemptions: z.array(z.object({
    path: z.string().min(1),
    reason: z.string().min(1)
  })).default([])
}).passthrough();

export const piiCheck: ICheck = {
  name: 'pii',
  description: 'Detects common PII patterns in committed files.',
  supportedTriggers: ['pre-commit', 'ci'],
  configSchema: PiiConfigSchema,
  async run(ctx: ICheckContext): Promise<IFinding[]> {
    const config = PiiConfigSchema.parse(ctx.config);
    const exemptionMatchers = config.exemptions.map((exemption) => picomatch(exemption.path));
    const patterns = [...config.patterns, ...config.extra_patterns].map((pattern) => ({
      ...pattern,
      regex: new RegExp(pattern.pattern, 'i')
    }));
    const findings: IFinding[] = [];

    for (const file of ctx.files) {
      if (file.isDeleted || exemptionMatchers.some((matcher) => matcher(file.path))) {
        continue;
      }

      const content = await file.content();
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        for (const pattern of patterns) {
          if (pattern.regex.test(lines[index])) {
            findings.push({
              check: 'pii',
              severity: ctx.mode === 'enforce' ? 'error' : 'warning',
              file: file.path,
              line: index + 1,
              message: pattern.message,
              ruleId: `pii.${pattern.name}`
            });
          }
        }
      }
    }

    return findings;
  }
};
