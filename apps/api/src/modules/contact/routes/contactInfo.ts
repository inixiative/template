/**
 * @atlas
 * @kind route
 * @partOf feature:contact
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { contactInfoResponseSchema } from '#/modules/contact/schemas/contactInfoResponseSchema';
import { Modules } from '#/modules/modules';

export const contactInfoRoute = readRoute({
  model: Modules.contact,
  action: 'info',
  skipId: true,
  responseSchema: contactInfoResponseSchema,
  description:
    'Lists every contact type: the JSON Schema a create or update body `value` may take (`input`), the canonical shape it is stored as (`value`), the allowed `subtype` values and whether a subtype is forbidden, optional or required, and how uniqueness is scoped. Public endpoint.',
});
