/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses feature:email
 */
import { DbAction, type HookOptions, HookTiming, type ModelName, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';
import { RULE_REFERENCE_SURFACES } from '#/hooks/ruleReference/surfaces';
import { type OwnerRow, syncRuleReferences } from '#/hooks/ruleReference/sync';

type Row = Record<string, unknown>;
type Payload = Row | Row[] | undefined;

const payloadOf = (action: DbAction, args: unknown, hasPreImage: boolean): Payload => {
  const { data, create, update } = (args ?? {}) as { data?: Payload; create?: Payload; update?: Payload };
  if (action !== DbAction.upsert) return data;
  return hasPreImage ? update : create;
};

const touches = (payload: Payload, columns: readonly string[]): boolean =>
  castArray(payload ?? []).some(
    (item) => typeof item === 'object' && item !== null && columns.some((column) => column in item),
  );

export const registerRuleReferenceHook = () => {
  registerDbHook(
    'ruleReference',
    Object.keys(RULE_REFERENCE_SURFACES),
    HookTiming.after,
    [DbAction.create, DbAction.update, DbAction.upsert, DbAction.createManyAndReturn, DbAction.updateManyAndReturn],
    async ({ model, action, args, previous, result }: HookOptions) => {
      const surface = RULE_REFERENCE_SURFACES[model as ModelName];
      if (!surface) return;
      const hasPreImage = Array.isArray(previous) ? previous.length > 0 : previous != null;
      if (!touches(payloadOf(action, args, hasPreImage), surface.columns)) return;
      const rows = castArray(result ?? []) as OwnerRow[];
      if (!rows.length) return;
      await syncRuleReferences(model as ModelName, rows);
    },
  );
};
