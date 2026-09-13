/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:segment
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { segmentReadResponseSchema } from '#/modules/segment/schemas/segmentSchemas';

export const organizationReadManySegmentsRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.segment,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('Segment') },
  responseSchema: segmentReadResponseSchema,
  middleware: [validatePermission('read')],
});
