import { ContactScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validateOwnerPermission } from '#/middleware/validations/validateOwnerPermission';
import { Modules } from '#/modules/modules';
import { contactUpdateBodySchema } from '#/modules/contact/schemas/contactSchemas';

export const contactUpdateRoute = updateRoute({
  model: Modules.contact,
  middleware: [validateOwnerPermission({ action: 'manage' })],
  bodySchema: contactUpdateBodySchema,
  // Owner discriminator is immutable; type would silently break valueKey indexing.
  sanitizeKeys: ['type', 'ownerModel', 'userId', 'organizationId', 'spaceId'],
  responseSchema: ContactScalarSchema,
});
