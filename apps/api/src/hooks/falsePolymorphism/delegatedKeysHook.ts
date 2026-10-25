import {
  DbAction,
  db,
  delegatedParent,
  HookTiming,
  keysFromParent,
  type ModelName,
  type PolymorphicAxis,
  PolymorphismRegistry,
  registerDbHook,
  toModelName,
} from '@template/db';
import { castArray } from 'lodash-es';
import { makeError } from '#/lib/errors';

type Row = Record<string, unknown>;

const delegatingAxes = (model: ModelName): PolymorphicAxis[] =>
  (
    (PolymorphismRegistry as Partial<Record<string, { axes: readonly PolymorphicAxis[] }>>)[model]
      ?.axes ?? []
  ).filter((axis) => axis.delegates);

const delegatingModels = Object.keys(PolymorphismRegistry)
  .map(toModelName)
  .filter((model) => delegatingAxes(model).length);

const carryParentKeys = async (model: ModelName, row: Row): Promise<void> => {
  for (const axis of delegatingAxes(model)) {
    const value = row[axis.field];
    const parent = delegatedParent(axis, value);
    if (!parent) continue;
    const [parentKey] = axis.fkMap[value as keyof typeof axis.fkMap] ?? [];
    const parentId = parentKey ? row[parentKey] : null;
    const parentRow = parentId
      ? ((await db.delegate(parent).findUnique({ where: { id: parentId } })) as Row | null)
      : null;
    if (!parentRow)
      throw makeError({
        status: 422,
        message: `${model} with ${axis.field}=${value} needs its ${parent}`,
      });
    Object.assign(row, keysFromParent(axis, value, parentRow));
  }
};

export const registerDelegatedKeysHook = () => {
  registerDbHook(
    'falsePolymorphism:delegatedKeys',
    delegatingModels,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => {
      for (const row of castArray((args as { data: Row | Row[] }).data) as Row[])
        await carryParentKeys(model, row);
    },
  );
};
