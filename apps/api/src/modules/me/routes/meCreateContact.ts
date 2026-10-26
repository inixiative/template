/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:contact
 */
import { createRoute } from '#/lib/routeTemplates';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import {
  CONTACT_CREATE_IMMUTABLE_FIELDS,
  contactCreateBodySchema,
  contactReadResponseSchema,
} from '#/modules/contact/schemas/contactSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meCreateContactRoute = createRoute({
  model: Modules.me,
  middleware: [validateSubmodelPermission('create')],
  submodel: Modules.contact,
  skipId: true,
  bodySchema: contactCreateBodySchema,
  responseSchema: contactReadResponseSchema,
  sanitizeKeys: CONTACT_CREATE_IMMUTABLE_FIELDS,
  tags: [Tags.me, Tags.contact],
});
