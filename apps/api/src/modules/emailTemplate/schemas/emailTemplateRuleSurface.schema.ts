/**
 * @atlas
 * @kind schema
 * @partOf feature:email
 * @uses none
 */
import { z } from '@hono/zod-openapi';

export const emailTemplateRuleSurfaceBodySchema = z
  .object({ slug: z.string().min(1), locale: z.string().optional() })
  .openapi('EmailTemplateRuleSurfaceBody');

export const emailTemplateRuleSurfaceResponseSchema = z
  .object({
    source: z.object({ maps: z.record(z.string(), z.unknown()), mapName: z.string(), model: z.string() }).passthrough(),
    sourceValues: z.array(z.unknown()),
    decoration: z.object({ facets: z.array(z.object({ path: z.string(), label: z.string() })) }),
  })
  .openapi('EmailTemplateRuleSurface');
