import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  PolymorphismRegistry,
  type Prisma,
  registerDbHook,
  type SingleAction,
} from '@template/db';
import { ContactRegistry } from '@template/shared/contact';
import { makeError } from '#/lib/errors';
import { nextSortOrder } from '#/lib/prisma/orderedList';

type ContactRow = Partial<Prisma.ContactGetPayload<Record<string, never>>> & Record<string, unknown>;

// Derived from the polymorphism registry — single source of truth.
const ownerKeyFields = [...new Set(Object.values(PolymorphismRegistry.Contact?.axes[0]?.fkMap ?? {}).flat())];

const ownerWhereFromRow = (row: ContactRow): Record<string, string | null> =>
  Object.fromEntries(ownerKeyFields.map((k) => [k, (row[k] as string | null | undefined) ?? null]));

// Validate + normalize a single Contact row in place. The row mutation makes
// `valueKey` and the canonical `value` shape persist when Prisma writes.
const processContactRow = async (row: ContactRow, isUpdate: boolean): Promise<void> => {
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

  // sortOrder: append to bottom on create when caller didn't supply one.
  // Reorder is handled at the route layer via reorderInList.
  if (!isUpdate && row.sortOrder == null) {
    const ownerWhere = ownerWhereFromRow(row);
    if (ownerKeyFields.some((k) => ownerWhere[k] !== null)) {
      row.sortOrder = await nextSortOrder(db.contact, { ...ownerWhere, type: row.type });
    }
  }
};

// Returns a contact row from createMany / create args (data: T | T[] form).
const extractCreateRows = (args: unknown): ContactRow[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return Array.isArray(a.data) ? (a.data as ContactRow[]) : [a.data as ContactRow];
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
      for (const row of extractCreateRows(args)) await processContactRow(row, false);
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
    if (create) await processContactRow(create, false);
    if (update) {
      const prev = previous as ContactRow | undefined;
      const merged: ContactRow = { ...(prev ?? {}), ...update };
      await processContactRow(merged, true);
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
      const prev = previous as ContactRow | undefined;
      const merged: ContactRow = { ...(prev ?? {}), ...data };
      await processContactRow(merged, true);
      mirrorComputed(data, merged);
    },
  );
};
