/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:segment
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import {
  SEGMENT_CREATE_IMMUTABLE_FIELDS,
  segmentCreateBodySchema,
  segmentReadResponseSchema,
} from '#/modules/segment/schemas/segmentSchemas';

export const organizationCreateSegmentRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.segment,
  bodySchema: segmentCreateBodySchema,
  responseSchema: segmentReadResponseSchema,
  middleware: [validateSubmodelPermission('create')],
  sanitizeKeys: SEGMENT_CREATE_IMMUTABLE_FIELDS,
});
