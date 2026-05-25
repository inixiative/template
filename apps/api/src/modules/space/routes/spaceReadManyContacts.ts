import { ContactScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { contactPicks } from '#/modules/contact/schemas/contactPicks';
import { Modules } from '#/modules/modules';

export const spaceReadManyContactsRoute = readRoute({
  model: Modules.space,
  submodel: Modules.contact,
  many: true,
  paginate: true,
  narrowing: {
    parent: lensFor('Contact'),
    root: {
      picks: contactPicks,
      where: { field: 'deletedAt', operator: 'equals', value: null },
    },
  },
  responseSchema: ContactScalarSchema,
  middleware: [
    validatePermission('read'),
    scopeNarrowing((c) => ({
      root: { where: { field: 'spaceId', operator: 'equals', value: getResource<'space'>(c).id } },
    })),
  ],
});
