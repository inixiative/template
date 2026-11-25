/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { PolymorphismRegistry } from '@template/db/registries/falsePolymorphism';
import { mapValues } from 'lodash-es';

export type OrderedListConfig = Record<string, string[]>;
export type OrderedListRegistry = Record<string, OrderedListConfig>;

const contactOwnerFields = [
  ...new Set(Object.values(PolymorphismRegistry.Contact?.axes[0]?.fkMap ?? {}).flat()),
];

export const orderedListRegistry: OrderedListRegistry = {
  Contact: {
    position: [...contactOwnerFields, 'type'],
  },
};

export const orderedListFieldsByModel = (): Record<string, string[]> =>
  mapValues(orderedListRegistry, (config) => Object.keys(config));
