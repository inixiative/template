/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:segment
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import {
  SEGMENT_CREATE_IMMUTABLE_FIELDS,
  segmentCreateBodySchema,
  segmentReadResponseSchema,
} from '#/modules/segment/schemas/segmentSchemas';

export const spaceCreateSegmentRoute = createRoute({
  model: Modules.space,
  submodel: Modules.segment,
  bodySchema: segmentCreateBodySchema,
  responseSchema: segmentReadResponseSchema,
  middleware: [validatePermission('manage')],
  sanitizeKeys: SEGMENT_CREATE_IMMUTABLE_FIELDS,
});
