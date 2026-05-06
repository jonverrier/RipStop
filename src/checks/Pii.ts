/**
 * @module Pii
 * Regex-based PII detection for source files.
 */
// Copyright (c) 2026 Jon Verrier

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
