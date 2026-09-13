/**
 * @atlas
 * @kind route
 * @partOf feature:segment
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import {
  SEGMENT_CREATE_IMMUTABLE_FIELDS,
  segmentReadResponseSchema,
  segmentUpdateBodySchema,
} from '#/modules/segment/schemas/segmentSchemas';

export const segmentUpdateRoute = updateRoute({
  model: Modules.segment,
  middleware: [validatePermission('manage')],
  bodySchema: segmentUpdateBodySchema,
  sanitizeKeys: SEGMENT_CREATE_IMMUTABLE_FIELDS,
  responseSchema: segmentReadResponseSchema,
});
