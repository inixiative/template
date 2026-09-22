/**
 * @atlas
 * @kind route
 * @partOf feature:segment, superadmin
 * @uses primitive:routeTemplates
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates/read';
import { Modules } from '#/modules/modules';
import { segmentReadResponseSchema } from '#/modules/segment/schemas/segmentSchemas';

export const segmentReadManyRoute = readRoute({
  model: Modules.segment,
  many: true,
  admin: true,
  paginate: true,
  filterLens: { parent: lensFor('Segment') },
  responseSchema: segmentReadResponseSchema,
  description: 'Every segment of every owner; filter on ownerModel for the platform’s own.',
});
