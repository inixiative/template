import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import {
  contactCreateBodySchema,
  contactReadResponseSchema,
} from '#/modules/contact/schemas/contactSchemas';

export const meCreateContactRoute = createRoute({
  model: Modules.me,
  submodel: Modules.contact,
  skipId: true,
  bodySchema: contactCreateBodySchema,
  responseSchema: contactReadResponseSchema,
  tags: [Tags.me, Tags.contact],
});
