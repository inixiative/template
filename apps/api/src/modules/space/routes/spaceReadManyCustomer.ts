import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { customerRefAsProviderSchema, customerRefTags } from '#/modules/customerRef/schemas/customerRefSchemas';
import { Modules } from '#/modules/modules';

// List customers of this space (where space is the provider)
export const spaceReadManyCustomerRoute = readRoute({
  model: Modules.space,
  submodel: Modules.customer,
  many: true,
  paginate: true,
  responseSchema: customerRefAsProviderSchema,
  middleware: [validatePermission('read')],
  tags: [...customerRefTags],
});
