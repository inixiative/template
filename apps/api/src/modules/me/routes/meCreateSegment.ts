/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import {
  SEGMENT_CREATE_IMMUTABLE_FIELDS,
  segmentCreateBodySchema,
  segmentReadResponseSchema,
} from '#/modules/segment/schemas/segmentSchemas';

export const meCreateSegmentRoute = createRoute({
  model: Modules.me,
  middleware: [validateSubmodelPermission('create')],
  submodel: Modules.segment,
  skipId: true,
  bodySchema: segmentCreateBodySchema,
  responseSchema: segmentReadResponseSchema,
  sanitizeKeys: SEGMENT_CREATE_IMMUTABLE_FIELDS,
  tags: [OpenApiTags.me, OpenApiTags.segment],
});
