/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:customer
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  customerRelationshipAsProviderSchema,
  customerRelationshipTags,
} from '#/modules/customerRelationship/schemas/customerRelationshipSchemas';
import { Modules } from '#/modules/modules';

// List customers of this space (where space is the provider)
export const spaceReadManyCustomersRoute = readRoute({
  model: Modules.space,
  submodel: Modules.customer,
  many: true,
  paginate: true,
  filterLens: { parent: lensFor('CustomerRelationship') },
  responseSchema: customerRelationshipAsProviderSchema,
  middleware: [validatePermission('read')],
  tags: [...customerRelationshipTags],
});
