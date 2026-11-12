/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:contact
 */
import { ContactScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { contactPicks } from '#/modules/contact/schemas/contactPicks';
import { Modules } from '#/modules/modules';

export const organizationReadManyContactsRoute = readRoute({
  model: Modules.organization,
  submodel: Modules.contact,
  many: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Contact'),
    root: { picks: contactPicks },
  },
  responseSchema: ContactScalarSchema,
  middleware: [validateSubmodelPermission('read')],
});
