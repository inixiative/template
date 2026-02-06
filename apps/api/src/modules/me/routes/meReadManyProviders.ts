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
  query: providerFilterSchema,
  responseSchema: customerRefAsCustomerSchema,
  tags: [Tags.me, Tags.provider, ...customerRefTags],
});
