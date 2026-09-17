/**
 * @atlas
 * @kind schema
 * @partOf feature:email
 * @uses none
 */
import { z } from '@hono/zod-openapi';

export const emailTemplatePreflightBodySchema = z
  .object({
    mjml: z.string().min(1),
    subject: z.string().optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .optional()
      .describe(
        "Slug of the template being authored; resolves tokens against that template's rule surface. Without it, tokens are checked against the base recipient/data projection and unresolved ones are warnings.",
      ),
    locale: z.string().optional(),
  })
  .openapi('EmailTemplatePreflightBody');

export const emailTemplatePreflightFindingSchema = z
  .object({
    code: z.string(),
    severity: z.enum(['error', 'warning']),
    message: z.string(),
    location: z.string().optional(),
  })
  .openapi('EmailTemplatePreflightFinding');

export const emailTemplatePreflightResponseSchema = z
  .object({
    findings: z.array(emailTemplatePreflightFindingSchema),
    summary: z.object({ errors: z.number(), warnings: z.number() }),
    renderWarnings: z.array(z.string()),
  })
  .openapi('EmailTemplatePreflight');
