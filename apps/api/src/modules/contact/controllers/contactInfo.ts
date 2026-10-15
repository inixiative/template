/**
 * @atlas
 * @kind controller
 * @partOf feature:contact
 * @uses primitive:routeTemplates
 */
import { ContactRegistry } from '@template/shared/contact';
import { mapValues } from 'lodash-es';
import { toJsonSchema } from '#/lib/jsonSchema/toJsonSchema';
import { makeController } from '#/lib/utils/makeController';
import { contactInfoRoute } from '#/modules/contact/routes/contactInfo';

export const contactInfoController = makeController(contactInfoRoute, async (_c, respond) => {
  return respond.ok({
    types: mapValues(ContactRegistry, (def) => ({
      label: def.display.label,
      icon: def.display.icon,
      input: toJsonSchema(def.inputSchema, 'input'),
      value: toJsonSchema(def.valueSchema, 'output'),
      subtype: {
        mode: def.subtype.mode,
        values: def.subtype.mode === 'forbidden' ? [] : [...def.subtype.values],
      },
      uniqueness: def.uniqueness,
    })),
  });
});
