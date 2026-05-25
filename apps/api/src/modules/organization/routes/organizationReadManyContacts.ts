import { ContactScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationReadManyContactsRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.contact,
  many: true,
  paginate: true,
  middleware: [
    validatePermission('read'),
    scopeNarrowing((c) => ({
      where: {
        all: [
          { field: 'organizationId', operator: 'equals', value: getResource<'organization'>(c).id },
          { field: 'deletedAt', operator: 'equals', value: null },
        ],
      },
    })),
  ],
  narrowing: {
    parent: lensFor('Contact'),
    maps: { default: { models: { Contact: { picks: ['type', 'subtype', 'label', 'valueKey'] } } } },
  },
  responseSchema: ContactScalarSchema,
});
