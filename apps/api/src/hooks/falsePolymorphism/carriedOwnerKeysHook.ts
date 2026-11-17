import {
  carryOwnerKeys,
  DbAction,
  HookTiming,
  type ModelName,
  PolymorphismRegistry,
  registerDbHook,
  toModelName,
} from '@template/db';
import { castArray } from 'lodash-es';

type Row = Record<string, unknown>;

const modelsCarryingOwnerKeys: ModelName[] = Object.entries(PolymorphismRegistry)
  .filter(([, config]) => config.axes.some((axis) => 'carriesOwnerKeysOf' in axis))
  .map(([model]) => toModelName(model));

export const registerCarriedOwnerKeysHook = () => {
  registerDbHook(
    'falsePolymorphism:carriedOwnerKeys',
    modelsCarryingOwnerKeys,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => {
      for (const row of castArray((args as { data: Row | Row[] }).data) as Row[])
        await carryOwnerKeys(model, row);
    },
  );

  registerDbHook(
    'falsePolymorphism:carriedOwnerKeys:upsert',
    modelsCarryingOwnerKeys,
    HookTiming.before,
    [DbAction.upsert],
    async ({ model, args }) => {
      const { create } = args as { create?: Row };
      if (create) await carryOwnerKeys(model, create);
    },
  );
};
