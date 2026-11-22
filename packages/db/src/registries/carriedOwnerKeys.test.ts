import { describe, expect, it } from 'bun:test';
import { keysHeldOnAxis } from '@template/db/registries/carriedOwnerKeys';
import {
  type PolymorphicAxis,
  PolymorphismRegistry,
  polymorphismConfigForModel,
} from '@template/db/registries/falsePolymorphism';
import { isModelName, type ModelName, toModelName } from '@template/db/utils/modelNames';

const ownedModel = (value: string): value is ModelName =>
  isModelName(value) &&
  Boolean(polymorphismConfigForModel(value)?.axes.some((axis) => axis.field === 'ownerModel'));

const filesUnderAnOwner = (axis: PolymorphicAxis) =>
  axis.field === 'ownerModel' || Boolean(axis.carriesOwnerKeysOf);

const axesFilingUnderAnOwner = Object.keys(PolymorphismRegistry)
  .map(toModelName)
  .flatMap((model) =>
    (polymorphismConfigForModel(model)?.axes ?? [])
      .filter(filesUnderAnOwner)
      .map((axis) => ({ model, axis })),
  );

describe('a row filed under a record that has an owner carries that owner chain (Aron, 2026-11-19)', () => {
  it('every arm naming an owned record is listed in carriesOwnerKeysOf', () => {
    const missing = axesFilingUnderAnOwner.flatMap(({ model, axis }) =>
      Object.keys(axis.fkMap)
        .filter(ownedModel)
        .filter((value) => !axis.carriesOwnerKeysOf?.includes(value))
        .map((value) => `${model}.${axis.field}=${value}`),
    );
    expect(missing).toEqual([]);
  });

  it('every carried arm has a column for each key the carried record holds', () => {
    for (const { model, axis } of axesFilingUnderAnOwner)
      for (const value of axis.carriesOwnerKeysOf ?? [])
        expect(() => keysHeldOnAxis(model, axis, value)).not.toThrow();
  });
});
