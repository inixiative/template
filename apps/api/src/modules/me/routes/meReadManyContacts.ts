/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:contact
 */
import { ContactScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { contactPicks } from '#/modules/contact/schemas/contactPicks';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadManyContactsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.contact,
  many: true,
  paginate: true,
  skipId: true,
  filterLens: {
    parent: lensFor('Contact'),
    root: { picks: contactPicks },
  },
  responseSchema: ContactScalarSchema,
  tags: [Tags.me, Tags.contact],
});
