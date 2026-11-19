import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { faker } from '@faker-js/faker';
import { db } from '@template/db/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import {
  discriminatorRequiresValue,
  withDiscriminatorDefaults,
} from '@template/db/registries/discriminatorDefaults';
import { polymorphismConfigForModel } from '@template/db/registries/falsePolymorphism';
import { cleanupTouchedTables } from '@template/db/test';
import * as factories from '@template/db/test/factories';
import {
  nextFactorySequenceNumber,
  registeredDefaults,
  registeredDependencies,
  resetSequence,
} from '@template/db/test/factory';
import type { ModelName } from '@template/db/test/factoryTypes';
import { modelNames } from '@template/db/utils/modelNames';

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
    polymorphismConfigForModel(modelName)?.axes.some((axis) =>
      discriminatorRequiresValue(modelName, axis.field),
    )
  )
    return true;
  return Object.values(registeredDependencies(modelName)).some(
    (dependency) => dependency.required && requiresDiscriminator(dependency.modelName, seen),
  );
};

describe('every model', () => {
  it('has a factory', () => {
    const modelsWithFactory = new Set(creators.map(([name]) => name.slice('create'.length)));
    expect(modelNames.filter((modelName) => !modelsWithFactory.has(modelName))).toEqual([]);
  });
});

describe('every factory against the polymorphism registry', () => {
  afterEach(async () => {
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

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type Field = { kind: string; isId?: boolean; isUnique?: boolean; fromFields?: readonly string[] };
type Model = {
  fields: Record<string, Field>;
  indexes?: readonly { kind: string; fields: readonly string[] }[];
};

const uniqueKeysOf = (modelName: ModelName): string[][] => {
  const model = (prismaMap.models as Record<string, Model>)[modelName];
  const fields = Object.entries(model.fields);
  const foreignKeys = new Set(fields.flatMap(([, field]) => field.fromFields ?? []));
  return [
    ...fields.filter(([, field]) => field.isId || field.isUnique).map(([name]) => [name]),
    ...(model.indexes ?? [])
      .filter((index) => index.kind === 'unique' || index.kind === 'id')
      .map((index) => [...index.fields]),
  ].map((key) => key.filter((field) => !foreignKeys.has(field)));
};

const SEEDS = Array.from({ length: 32 }, (_, index) => index + 1);

const defaultsAt = (
  modelName: ModelName,
  defaults: () => unknown,
  { step, seed }: { step: number; seed: number },
): Record<string, unknown> => {
  resetSequence();
  for (let i = 0; i < step; i++) nextFactorySequenceNumber();
  faker.seed(seed);
  return withDiscriminatorDefaults(modelName, defaults() as Record<string, unknown>);
};

const keyValue = (row: Record<string, unknown>, key: string[]) =>
  key.map((field) => String(row[field])).join('\u0000');

const collidingKeys = (): string[] =>
  modelNames
    .flatMap((modelName) => {
      const defaults = registeredDefaults(modelName);
      if (!defaults) return [];
      const [first, ...otherSeeds] = SEEDS.map((seed) =>
        defaultsAt(modelName, defaults, { step: 0, seed }),
      );
      const replay = defaultsAt(modelName, defaults, { step: 0, seed: SEEDS[0] });
      const nextStep = defaultsAt(modelName, defaults, { step: 1, seed: SEEDS[0] });
      return uniqueKeysOf(modelName)
        .filter((key) => key.length && key.every((field) => first[field] != null))
        .filter((key) => !key.some((field) => UUID.test(String(first[field]))))
        .filter((key) => {
          const value = keyValue(first, key);
          const isOutsideFaker = value !== keyValue(replay, key);
          const isFromFaker = otherSeeds.some((row) => keyValue(row, key) !== value);
          const isFromSequence = value !== keyValue(nextStep, key);
          return isOutsideFaker || (isFromFaker && !isFromSequence);
        })
        .map((key) => `${modelName}.${key.join('+')}`);
    })
    .filter((key, index, keys) => keys.indexOf(key) === index);

describe('every factory against the unique keys', () => {
  const resumeAt = nextFactorySequenceNumber();

  afterAll(() => {
    faker.seed();
    resetSequence();
    while (nextFactorySequenceNumber() < resumeAt);
  });

  it('every unique key a factory fills changes with the sequence, so two rows in one test cannot collide', () => {
    expect(collidingKeys()).toEqual([]);
  });

  it('the check sees field-level and composite unique keys, so it cannot pass by finding none', () => {
    expect(uniqueKeysOf('User')).toContainEqual(['email']);
    expect(
      modelNames.flatMap((modelName) => uniqueKeysOf(modelName)).some((key) => key.length > 1),
    ).toBe(true);
  });
});
