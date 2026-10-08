import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db/client';
import { discriminatorRequiresValue } from '@template/db/registries/discriminatorDefaults';
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import { cleanupTouchedTables } from '@template/db/test';
import * as factories from '@template/db/test/factories';
import { registeredDependencies } from '@template/db/test/factory';
import type { ModelName } from '@template/db/test/factoryTypes';

type CreateWithDefaults = () => Promise<{ entity: { id: string } }>;

const creators = Object.entries(factories).flatMap(([name, value]) =>
  name.startsWith('create') && typeof value === 'function'
    ? [[name, value as unknown as CreateWithDefaults] as const]
    : [],
);

const requiresDiscriminator = (modelName: ModelName, seen = new Set<ModelName>()): boolean => {
  if (seen.has(modelName)) return false;
  seen.add(modelName);
  if (
    getPolymorphismConfig(modelName)?.axes.some((axis) =>
      discriminatorRequiresValue(modelName, axis.field),
    )
  )
    return true;
  return Object.values(registeredDependencies(modelName)).some(
    (dependency) => dependency.required && requiresDiscriminator(dependency.modelName, seen),
  );
};

describe('every factory against the polymorphism registry', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  for (const [name, create] of creators) {
    const modelName = name.slice('create'.length) as ModelName;
    if (requiresDiscriminator(modelName))
      it(`${name} refuses to choose a discriminator for the caller`, async () => {
        await expect(create()).rejects.toThrow('is required — pass it');
      });
    else
      it(`${name} persists a row with its defaults`, async () => {
        const { entity } = await create();
        expect(entity.id).toBeString();
      });
  }
});
