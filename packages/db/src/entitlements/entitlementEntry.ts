/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, primitive:authz
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import type { EntitlementEntry } from '@inixiative/permissions';
import type { Entitlement, Prisma } from '@template/db/generated/client/client';
import type {
  EntitlementResourceModel,
  EntitlementTargetModel,
} from '@template/db/generated/client/enums';
import { resolveFalsePolymorphismRef } from '@template/db/registries/falsePolymorphism';
import { toAccessor, toModelName } from '@template/db/utils/modelNames';

export type EntitlementTarget = { model: EntitlementTargetModel; id: string };

type StoredEntitlement = Pick<
  Entitlement,
  'resource' | 'actions' | 'where' | 'sourceModel' | 'sourceId' | 'sourcePath'
>;

const resourceOf = (model: string): string => `db:${toAccessor(model)}`;

const modelOf = (resource: string): EntitlementResourceModel =>
  toModelName(resource.slice('db:'.length)) as EntitlementResourceModel;

const foreignKey = (axis: 'sourceModel' | 'targetModel', model: string): string => {
  const column = resolveFalsePolymorphismRef({ model: 'Entitlement', axis, value: model });
  if (!column) throw new Error(`Entitlement has no ${axis} column for ${model}`);
  return column;
};

/** A stored row as the library's entry: no path or where when the row has none, actions as a map. */
export const toEntitlementEntry = (row: StoredEntitlement): EntitlementEntry => ({
  resource: resourceOf(row.resource),
  anchor: {
    resource: resourceOf(row.sourceModel),
    id: row.sourceId,
    ...(row.sourcePath ? { path: row.sourcePath } : {}),
  },
  ...(row.where != null ? { where: row.where as Condition } : {}),
  actions: Object.fromEntries(row.actions.map((action) => [action, true])),
});

/** A stored row as the API lists it: its entry and the id that removes it. */
export const toEntitlementRowEntry = (
  row: StoredEntitlement & Pick<Entitlement, 'id'>,
): EntitlementEntry & { id: string } => ({ id: row.id, ...toEntitlementEntry(row) });

/** The row that stores an entry on a target. */
export const toEntitlementRow = (
  entry: EntitlementEntry,
  target: EntitlementTarget,
): Prisma.EntitlementUncheckedCreateInput => {
  const sourceModel = modelOf(entry.anchor.resource);
  return {
    resource: modelOf(entry.resource),
    actions: Object.entries(entry.actions)
      .filter(([, held]) => held === true)
      .map(([action]) => action),
    ...(entry.where !== undefined ? { where: entry.where as Prisma.InputJsonValue } : {}),
    sourceModel,
    sourceId: entry.anchor.id,
    [foreignKey('sourceModel', sourceModel)]: entry.anchor.id,
    sourcePath: entry.anchor.path ?? null,
    targetModel: target.model,
    targetId: target.id,
    [foreignKey('targetModel', target.model)]: target.id,
  };
};
