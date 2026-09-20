/**
 * @atlas
 * @kind schema
 * @partOf feature:email
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { EmailTemplateScalarInputSchema } from '@template/db';

export const emailTemplatePreflightBodySchema = EmailTemplateScalarInputSchema.pick({
  slug: true,
  locale: true,
  ownerModel: true,
  organizationId: true,
  spaceId: true,
  userId: true,
  mjml: true,
  subject: true,
})
  .partial({ slug: true, subject: true })
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
