import { PolymorphismRegistry } from '@template/db';
import type { OrderedListRegistry } from '#/lib/prisma/orderedList';

const contactOwnerFields = [
  ...new Set(Object.values(PolymorphismRegistry.Contact?.axes[0]?.fkMap ?? {}).flat()),
];

export const orderedListRegistry: OrderedListRegistry = {
  Contact: {
    position: [...contactOwnerFields, 'type'],
  },
};
