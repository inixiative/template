/**
 * @atlas
 * @kind route
 * @partOf feature:segment, superadmin
 * @uses primitive:routeTemplates
 */
import { createRoute } from '#/lib/routeTemplates/create';
import { Modules } from '#/modules/modules';
import {
  SEGMENT_CREATE_IMMUTABLE_FIELDS,
  segmentCreateBodySchema,
  segmentReadResponseSchema,
} from '#/modules/segment/schemas/segmentSchemas';

export const segmentCreateRoute = createRoute({
  model: Modules.segment,
  admin: true,
  bodySchema: segmentCreateBodySchema,
  responseSchema: segmentReadResponseSchema,
  sanitizeKeys: SEGMENT_CREATE_IMMUTABLE_FIELDS,
  description: 'Creates a segment owned by the platform, over the platform’s own customers.',
});
