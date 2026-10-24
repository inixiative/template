/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses feature:email, feature:segment
 */
import {
  assertRuleReferencesExist,
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  RuleReferenceError,
  registerDbHook,
  syncRuleReferenceEdges,
} from '@template/db';
import type { RuleReference } from '@template/shared/rules';
import { castArray, compact, isEqual, keyBy } from 'lodash-es';
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
  return rowsOf(result).filter((row) =>
    columns.some((column) => !isEqual(before[row.id]?.[column], row[column])),
  );
};

/**
 * Makes each source's edges match its rule, from the rows as written. With a pre-image (a save),
 * the rule columns that changed are checked first; without one (a revive), nothing is.
 */
export const syncRuleReferences = async (
  model: string,
  rows: HookRow[],
  previous?: HookRow[],
): Promise<void> => {
  if (!isRuleReferenceSourceModel(model)) return;
  const surface = RULE_REFERENCE_SURFACES[model];
  const before = keyBy(previous ?? [], 'id');
  for (const row of rowsOf(rows)) {
    const { references, judged } =
      row.deletedAt == null
        ? await surface.read(
            row,
            previous ? changedColumns(row, before[row.id], surface.columns) : [],
          )
        : UNREFERENCED;
    if (previous) {
      const [unchecked] = judged.dynamic;
      if (unchecked)
        throw new RuleReferenceError(
          `rule names a ${unchecked.model} by a value read at evaluation (${unchecked.path}); name it by id`,
        );
      await assertRuleReferencesExist(judged.scopes, judged.references);
    }
    await syncRuleReferenceEdges({ model, id: row.id }, references);
  }
};

const assertWritesReturnFullRows = ({ model, args }: HookOptions): void => {
  const { select, omit } = (args ?? {}) as { select?: unknown; omit?: unknown };
  if (select !== undefined || omit !== undefined)
    throw new Error(
      `${model} carries a rule column: its writes return full rows, so a write may not pass select or omit`,
    );
};

export const registerRuleReferenceHook = () => {
  registerDbHook(
    'ruleReference:fullRows',
    Object.keys(RULE_REFERENCE_SURFACES),
    HookTiming.before,
    WRITE_ACTIONS,
    async (options: HookOptions) => assertWritesReturnFullRows(options),
  );
  registerDbHook(
    'ruleReference',
    Object.keys(RULE_REFERENCE_SURFACES),
    HookTiming.after,
    WRITE_ACTIONS,
    async ({ model, previous, result }: HookOptions) => {
      if (!isRuleReferenceSourceModel(model)) return;
      const touched = touchedRows(previous, result, RULE_REFERENCE_SURFACES[model].columns);
      if (touched.length) await syncRuleReferences(model, touched, rowsOf(previous));
    },
  );
};
