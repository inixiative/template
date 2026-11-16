/**
 * @atlas
 * @kind route
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryResolutionStatusSchema } from '#/modules/inquiry/schemas/inquiryResolutionStatusSchema';
import { inquiryReceivedResponseSchema } from '#/modules/inquiry/schemas/inquiryResponseSchemas';
import { inquiryVersionSchema } from '#/modules/inquiry/schemas/inquiryVersionSchema';
import { Modules } from '#/modules/modules';

// why: a type's own response fields are parsed downstream by its handler's `resolutionInputSchema`
const bodySchema = inquiryVersionSchema
  .extend({
    status: inquiryResolutionStatusSchema,
    explanation: z.string().optional(),
  })
  .passthrough();

export const inquiryResolveRoute = actionRoute({
  model: Modules.inquiry,
  action: 'resolve',
  method: 'post',
  bodySchema,
  responseSchema: inquiryReceivedResponseSchema,
  description:
    "Resolves an inquiry: approve, deny, or request changes from the source. Other body fields are the type's resolution input; see GET /api/v1/inquiry/info (`types.<type>.resolutionInput`).",
  middleware: [validatePermission('resolve')],
});
