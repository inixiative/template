/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:customer
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { providerFilterSchema } from '#/modules/customerRelationship/schemas/customerRelationshipQuerySchemas';
import {
  customerRelationshipAsCustomerSchema,
  customerRelationshipTags,
} from '#/modules/customerRelationship/schemas/customerRelationshipSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyProvidersRoute = readRoute({
  model: Modules.me,
  middleware: [validatePermission('read')],
  submodel: Modules.provider,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('CustomerRelationship') },
  query: providerFilterSchema,
  responseSchema: customerRelationshipAsCustomerSchema,
  tags: [Tags.me, Tags.provider, ...customerRelationshipTags],
});
