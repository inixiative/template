import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import {
  CONTACT_CREATE_IMMUTABLE_FIELDS,
  contactCreateBodySchema,
  contactReadResponseSchema,
} from '#/modules/contact/schemas/contactSchemas';

export const meCreateContactRoute = createRoute({
  model: Modules.me,
  submodel: Modules.contact,
  skipId: true,
  bodySchema: contactCreateBodySchema,
  responseSchema: contactReadResponseSchema,
  sanitizeKeys: CONTACT_CREATE_IMMUTABLE_FIELDS,
  tags: [Tags.me, Tags.contact],
});
