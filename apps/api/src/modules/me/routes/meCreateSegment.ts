/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { Modules } from '#/modules/modules';
import {
  SEGMENT_CREATE_IMMUTABLE_FIELDS,
  segmentCreateBodySchema,
  segmentReadResponseSchema,
} from '#/modules/segment/schemas/segmentSchemas';
import { Tags } from '#/modules/tags';

export const meCreateSegmentRoute = createRoute({
  model: Modules.me,
  middleware: [validateSelfPermission('operate')],
  submodel: Modules.segment,
  skipId: true,
  bodySchema: segmentCreateBodySchema,
  responseSchema: segmentReadResponseSchema,
  sanitizeKeys: SEGMENT_CREATE_IMMUTABLE_FIELDS,
  tags: [Tags.me, Tags.segment],
});
