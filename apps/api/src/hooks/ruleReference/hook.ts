/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses feature:email, feature:segment
 */
import {
  DbAction,
  db,
  deadRuleReferences,
  type HookOptions,
  HookTiming,
  RuleReferenceError,
  registerDbHook,
  syncRuleReferenceEdges,
} from '@template/db';
import type { RuleReferenceSourceModel } from '@template/db/generated/client/enums';
import type { RuleReference } from '@template/shared/rules';
import { castArray, compact, isEqual, keyBy } from 'lodash-es';
import { deadReferencesError } from '#/hooks/ruleReference/deadReferencesError';
import {
  isRuleReferenceSourceModel,
  RULE_REFERENCE_SURFACES,
  type RuleReferenceReading,
} from '#/hooks/ruleReference/surfaces';
import type { HookRow } from '#/hooks/shared/hookRows';

type SourceRow = HookRow & { id: string };

const WRITE_ACTIONS = [
  DbAction.create,
  DbAction.createManyAndReturn,
  DbAction.update,
  DbAction.updateManyAndReturn,
  DbAction.upsert,
];

const UNREFERENCED: { references: RuleReference[]; judged: RuleReferenceReading } = {
  references: [],
  judged: { references: [], scopes: [], dynamic: [] },
};

const rowsOf = (value: unknown): SourceRow[] =>
  compact(castArray(value) as (HookRow | undefined)[]).filter(
    (row): row is SourceRow => typeof row.id === 'string',
  );

const holdsColumns = (row: HookRow, columns: readonly string[]): boolean =>
  columns.every((column) => column in row);

const changedColumns = (
  row: HookRow,
  before: HookRow | undefined,
  columns: readonly string[],
): string[] => columns.filter((column) => !before || !isEqual(before[column], row[column]));

const touchedRows = (
  previous: unknown,
  result: unknown,
  columns: readonly string[],
): SourceRow[] => {
  const before = keyBy(rowsOf(previous), 'id');
  return rowsOf(result).filter(
    (row) =>
      !holdsColumns(row, columns) ||
      columns.some((column) => !isEqual(before[row.id]?.[column], row[column])),
  );
};

const withColumns = async (
  model: RuleReferenceSourceModel,
  rows: SourceRow[],
): Promise<SourceRow[]> => {
  const { columns } = RULE_REFERENCE_SURFACES[model];
  const narrowed = rows.filter((row) => !holdsColumns(row, columns)).map((row) => row.id);
  if (!narrowed.length) return rows;
  const reread = keyBy(
    (await db.withDeleted(() =>
      db.delegate(model).findMany({ where: { id: { in: narrowed } } }),
    )) as SourceRow[],
    'id',
  );
  return rows.map((row) => reread[row.id] ?? row);
};

export const syncRuleReferences = async (
  model: RuleReferenceSourceModel,
  rows: SourceRow[],
  mode: 'save' | 'rebuild',
  previous: HookRow[] = [],
): Promise<void> => {
  const surface = RULE_REFERENCE_SURFACES[model];
  const before = keyBy(previous, 'id');
  for (const row of await withColumns(model, rows)) {
    const { references, judged } =
      row.deletedAt == null
        ? await surface.read(row, changedColumns(row, before[row.id], surface.columns))
        : UNREFERENCED;
    if (mode === 'save') {
      const [unchecked] = judged.dynamic;
      if (unchecked)
        throw new RuleReferenceError(
          `rule names a ${unchecked.model} by a value read at evaluation (${unchecked.path}); name it by id`,
        );
      const dead = await deadRuleReferences(judged.scopes, judged.references);
      if (dead.length) throw deadReferencesError(dead);
    }
    await syncRuleReferenceEdges({ model, id: row.id }, references);
  }
};

export const regenerateRuleReferences = async (model: string, rows: HookRow[]): Promise<void> => {
  if (!isRuleReferenceSourceModel(model)) return;
  const ids = rowsOf(rows).map((row) => row.id);
  if (!ids.length) return;
  const sources = (await db
    .delegate(model)
    .findMany({ where: { id: { in: ids } } })) as SourceRow[];
  await syncRuleReferences(model, sources, 'rebuild');
};

export const registerRuleReferenceHook = () => {
  registerDbHook(
    'ruleReference',
    Object.keys(RULE_REFERENCE_SURFACES),
    HookTiming.after,
    WRITE_ACTIONS,
    async ({ model, previous, result }: HookOptions) => {
      if (!isRuleReferenceSourceModel(model)) return;
      const touched = touchedRows(previous, result, RULE_REFERENCE_SURFACES[model].columns);
      if (touched.length) await syncRuleReferences(model, touched, 'save', rowsOf(previous));
    },
  );
};
