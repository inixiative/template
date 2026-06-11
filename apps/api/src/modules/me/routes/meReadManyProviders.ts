/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:customer
 */
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { providerFilterSchema } from '#/modules/customerRef/schemas/customerRefQuerySchemas';
import { customerRefAsCustomerSchema, customerRefTags } from '#/modules/customerRef/schemas/customerRefSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyProvidersRoute = readRoute({
  model: Modules.me,
  submodel: Modules.provider,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('CustomerRef') },
  query: providerFilterSchema,
  responseSchema: customerRefAsCustomerSchema,
  tags: [Tags.me, Tags.provider, ...customerRefTags],
});
