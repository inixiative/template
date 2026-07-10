import { DbAction, type HookOptions, HookTiming, type Prisma, registerDbHook, type SingleAction } from '@template/db';
import { ContactRegistry } from '@template/shared/contact';
import { toArray } from '@template/shared/utils';
import { makeError } from '#/lib/errors';

type ContactRow = Partial<Prisma.ContactGetPayload<Record<string, never>>> & Record<string, unknown>;

// Validate + normalize a single Contact row in place. The row mutation makes
// `valueKey` and the canonical `value` shape persist when Prisma writes.
const processContactRow = async (row: ContactRow): Promise<void> => {
  if (!row.type) return; // Pure update of unrelated fields — nothing to do here.
  const def = ContactRegistry[row.type as keyof typeof ContactRegistry];
  if (!def) throw makeError({ status: 422, message: `Unknown Contact type: ${row.type}` });

  // Subtype rules
  const sub = row.subtype ?? null;
  switch (def.subtype.mode) {
    case 'forbidden':
      if (sub !== null) throw makeError({ status: 422, message: `Contact type '${row.type}' must not have a subtype` });
      break;
    case 'required':
      if (sub === null) throw makeError({ status: 422, message: `Contact type '${row.type}' requires a subtype` });
      if (!def.subtype.values.includes(sub)) {
        throw makeError({ status: 422, message: `Invalid subtype '${sub}' for type '${row.type}'` });
      }
      break;
    case 'optional':
      if (sub !== null && !def.subtype.values.includes(sub)) {
        throw makeError({ status: 422, message: `Invalid subtype '${sub}' for type '${row.type}'` });
      }
      break;
  }

  // Value: parse loose input → canonical → set valueKey. Skip when value is
  // absent on update (caller is updating a different field). Per-owner
  // uniqueness is enforced by the @@unique([ownerModel, userId, …, type, valueKey])
  // constraint; Prisma throws P2002 on conflict, no manual pre-check needed.
  if (row.value !== undefined) {
    const input = def.inputSchema.parse(row.value);
    const canonical = def.parseInput(input);
    const validated = def.valueSchema.parse(canonical);
    row.value = validated;
    row.valueKey = def.toValueKey(validated);
  }

  // `position` is handled separately by the orderedList hook — Contact is
  // registered there and position assignment / shifts / soft-delete sentinels
  // all flow through that hook automatically. Nothing for us to do here.
};

// Returns a contact row from createMany / create args (data: T | T[] form).
const extractCreateRows = (args: unknown): ContactRow[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return toArray(a.data) as ContactRow[];
};

const mirrorComputed = (target: ContactRow, source: ContactRow): void => {
  if (source.valueKey !== undefined) target.valueKey = source.valueKey;
  if (source.value !== undefined && target.value !== undefined) target.value = source.value;
};

export const registerContactRulesHook = () => {
  // Pure create paths — args.data is the row (or array of rows).
  registerDbHook(
    'contactRules:create',
    'Contact',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of extractCreateRows(args)) await processContactRow(row);
    },
  );

  // Upsert: args is `{ where, create, update }`. Both create and update paths
  // need normalization — only one fires depending on row existence, but we
  // can't know until Prisma runs, so treat both: validate `create` as a fresh
  // row, validate `update` shadow-merged with previous (if available).
  registerDbHook('contactRules:upsert', 'Contact', HookTiming.before, [DbAction.upsert], async (options) => {
    const { args, previous } = options as HookOptions & { action: SingleAction };
    if (!args || typeof args !== 'object') return;
    const a = args as Record<string, unknown>;
    const create = a.create as ContactRow | undefined;
    const update = a.update as ContactRow | undefined;
    if (create) await processContactRow(create);
    if (update) {
      const prev = previous as ContactRow | undefined;
      const merged: ContactRow = { ...(prev ?? {}), ...update };
      await processContactRow(merged);
      mirrorComputed(update, merged);
    }
  });

  // Update paths — args.data is the partial update; merge with previous for
  // type-aware validation, then mirror hook-computed fields back into args.data.
  registerDbHook(
    'contactRules:update',
    'Contact',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous } = options as HookOptions & { action: SingleAction };
      if (!args || typeof args !== 'object') return;
      const a = args as Record<string, unknown>;
      const data = a.data as ContactRow | undefined;
      if (!data) return;
      // Metadata-only updates (e.g. deliverability) don't touch value/type/subtype — nothing to
      // validate or normalize, and re-parsing a stale stored value here would throw spuriously.
      if (data.value === undefined && data.type === undefined && data.subtype === undefined) return;
      const prev = previous as ContactRow | undefined;
      const merged: ContactRow = { ...(prev ?? {}), ...data };
      await processContactRow(merged);
      mirrorComputed(data, merged);
    },
  );
};
