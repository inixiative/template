import { describe, expect, it } from 'bun:test';
import { PolymorphismRegistry } from '@template/db/registries/falsePolymorphism';
import { toModelName } from '@template/db/utils/modelNames';
import { getModelRelations } from '@template/db/utils/prismaMapRelations';

const SPACE_PARENTS = ['Space', 'SpaceUser'] as const;

const keyFields = (foreignKey: unknown): string[] =>
  typeof foreignKey === 'string' ? [foreignKey] : Object.values(foreignKey ?? {});

describe('a row keyed to a space carries its organization through a composite key', () => {
  it('every Space or SpaceUser owner that holds an organization column has a relation on all its keys', () => {
    const missing = Object.entries(PolymorphismRegistry).flatMap(([name, config]) => {
      const model = toModelName(name);
      const relations = getModelRelations(model);
      return config.axes.flatMap((axis) =>
        SPACE_PARENTS.flatMap((parent) => {
          const fields = (axis.fkMap as Partial<Record<string, readonly string[]>>)[parent] ?? [];
          const organizationField = relations.find(
            ({ targetModel, foreignKey }) =>
              targetModel === 'Organization' &&
              keyFields(foreignKey).length === 1 &&
              fields.includes(keyFields(foreignKey)[0]!),
          );
          if (!organizationField) return [];
          const covered = relations.some(
            ({ targetModel, foreignKey }) =>
              targetModel === parent &&
              keyFields(foreignKey).length === fields.length &&
              fields.every((field) => keyFields(foreignKey).includes(field)),
          );
          return covered ? [] : [`${model}.${axis.field}=${parent} (${fields.join(', ')})`];
        }),
      );
    });

    expect(missing).toEqual([]);
  });
});
