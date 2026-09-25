/**
 * @atlas
 * @kind route
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquirySentResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { Modules } from '#/modules/modules';

const bodySchema = z.object({ content: z.unknown() }).partial();

export const inquiryUpdateRoute = updateRoute({
  model: Modules.inquiry,
  bodySchema,
  responseSchema: inquirySentResponseSchema,
  middleware: [validatePermission('send')],
});
