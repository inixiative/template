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
import { Modules } from '#/modules/modules';

// Per-handler resolution fields get validated downstream against
// `handler.resolutionInputSchema` and filtered in `resolveContent`. Pass them
// through here instead of stripping them.
const bodySchema = z
  .object({
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
  description: 'Resolves an inquiry: approve, deny, or request changes from the source.',
  middleware: [validatePermission('resolve')],
});
