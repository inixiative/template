/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:segment
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { segmentReadResponseSchema } from '#/modules/segment/schemas/segmentSchemas';
import { Tags } from '#/modules/tags';

export const meReadManySegmentsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.segment,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Segment') },
  responseSchema: segmentReadResponseSchema,
  tags: [Tags.me, Tags.segment],
});
