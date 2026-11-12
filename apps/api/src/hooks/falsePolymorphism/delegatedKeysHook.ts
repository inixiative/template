import {
  carryDelegatedKeys,
  DbAction,
  HookTiming,
  type ModelName,
  PolymorphismRegistry,
  registerDbHook,
  toModelName,
} from '@template/db';
import { castArray } from 'lodash-es';

type Row = Record<string, unknown>;

const delegatingModels: ModelName[] = Object.entries(PolymorphismRegistry)
  .filter(([, config]) => config.axes.some((axis) => 'delegates' in axis))
  .map(([model]) => toModelName(model));

export const registerDelegatedKeysHook = () => {
  registerDbHook(
    'falsePolymorphism:delegatedKeys',
    delegatingModels,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => {
      for (const row of castArray((args as { data: Row | Row[] }).data) as Row[])
        await carryDelegatedKeys(model, row);
    },
  );

  registerDbHook(
    'falsePolymorphism:delegatedKeys:upsert',
    delegatingModels,
    HookTiming.before,
    [DbAction.upsert],
    async ({ model, args }) => {
      const { create } = args as { create?: Row };
      if (create) await carryDelegatedKeys(model, create);
    },
  );
};
