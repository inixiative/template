/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import { segmentReadResponseSchema } from '#/modules/segment/schemas/segmentSchemas';

export const userReadManySegmentsRoute = readRoute({
  model: Modules.user,
  submodel: Modules.segment,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Segment') },
  responseSchema: segmentReadResponseSchema,
  middleware: [validatePermission('read')],
  tags: [OpenApiTags.user, OpenApiTags.segment],
});
