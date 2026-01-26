import { OrganizationUserScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserUpdateRoute = updateRoute({
  model: Modules.organizationUser,
  bodySchema: OrganizationUserScalarSchema.pick({ role: true, entitlements: true }).partial(),
  responseSchema: OrganizationUserScalarSchema,
});
