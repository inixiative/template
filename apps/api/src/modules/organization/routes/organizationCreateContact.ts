/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, feature:contact
 */
import { createRoute, permissionsBodyRefinement } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import {
  CONTACT_CREATE_IMMUTABLE_FIELDS,
  contactCreateBodySchema,
  contactReadResponseSchema,
} from '#/modules/contact/schemas/contactSchemas';
import { Modules } from '#/modules/modules';

export const organizationCreateContactRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.contact,
  bodyRefinement: permissionsBodyRefinement,
  bodySchema: contactCreateBodySchema,
  responseSchema: contactReadResponseSchema,
  middleware: [validateSubmodelPermission('create')],
  sanitizeKeys: CONTACT_CREATE_IMMUTABLE_FIELDS,
});
