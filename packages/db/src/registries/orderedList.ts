/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 */
import { PolymorphismRegistry } from '@template/db/registries/falsePolymorphism';

export type OrderedListConfig = Record<string, string[]>;
export type OrderedListRegistry = Record<string, OrderedListConfig>;

const contactOwnerFields = [...new Set(Object.values(PolymorphismRegistry.Contact?.axes[0]?.fkMap ?? {}).flat())];

export const orderedListRegistry: OrderedListRegistry = {
  Contact: {
    position: [...contactOwnerFields, 'type'],
  },
};

export const getOrderedListFieldsByModel = (): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  for (const [model, config] of Object.entries(orderedListRegistry)) {
    result[model] = Object.keys(config);
  }
  return result;
};
