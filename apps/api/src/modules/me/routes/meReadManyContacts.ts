import { ContactScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyContactsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.contact,
  many: true,
  paginate: true,
  skipId: true,
  narrowing: {
    parent: lensFor('Contact'),
    maps: { prisma: { models: { Contact: { picks: ['type', 'subtype', 'label', 'valueKey'] } } } },
  },
  responseSchema: ContactScalarSchema,
  tags: [Tags.me, Tags.contact],
  middleware: [
    scopeNarrowing((c) => ({
      where: {
        all: [
          { field: 'userId', operator: 'equals', value: c.get('user')!.id },
          { field: 'deletedAt', operator: 'equals', value: null },
        ],
      },
    })),
  ],
});
