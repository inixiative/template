import { DbAction, db, type HookOptions, HookTiming, PolymorphismRegistry, Prisma, registerDbHook, type SingleAction } from '@template/db';
import { ContactRegistry } from '@template/shared/contact';
import { HTTPException } from 'hono/http-exception';

type ContactRow = Partial<Prisma.ContactGetPayload<Record<string, never>>> & Record<string, unknown>;

// Derived from the polymorphism registry — single source of truth.
const ownerKeyFields = [
  ...new Set(
    Object.values(PolymorphismRegistry.Contact?.axes[0]?.fkMap ?? {}).flat(),
  ),
];

const ownerWhereFromRow = (row: ContactRow): Record<string, string | null> =>
  Object.fromEntries(ownerKeyFields.map((k) => [k, (row[k] as string | null | undefined) ?? null]));

// Validate + normalize a single Contact row in place. The row mutation makes
// `valueKey` and the canonical `value` shape persist when Prisma writes.
const processContactRow = async (row: ContactRow, _isUpdate: boolean, idForExclusion?: string): Promise<void> => {
  if (!row.type) return; // Pure update of unrelated fields — nothing to do here.
  const def = ContactRegistry[row.type as keyof typeof ContactRegistry];
  if (!def) throw new HTTPException(422, { message: `Unknown Contact type: ${row.type}` });

  // Subtype rules
  const sub = row.subtype ?? null;
  switch (def.subtype.mode) {
    case 'forbidden':
      if (sub !== null) throw new HTTPException(422, { message: `Contact type '${row.type}' must not have a subtype` });
      break;
    case 'required':
      if (sub === null) throw new HTTPException(422, { message: `Contact type '${row.type}' requires a subtype` });
      if (!def.subtype.values.includes(sub)) {
        throw new HTTPException(422, { message: `Invalid subtype '${sub}' for type '${row.type}'` });
      }
      break;
    case 'optional':
      if (sub !== null && !def.subtype.values.includes(sub)) {
        throw new HTTPException(422, { message: `Invalid subtype '${sub}' for type '${row.type}'` });
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

  // isPrimary uniqueness per (owner, type) — clear other primaries before this row sticks.
  if (row.isPrimary === true && row.type) {
    const ownerWhere = ownerWhereFromRow(row);
    if (ownerKeyFields.some((k) => ownerWhere[k] !== null)) {
      await db.contact.updateManyAndReturn({
        where: {
          ...ownerWhere,
          type: row.type,
          isPrimary: true,
          deletedAt: null,
          ...(idForExclusion ? { NOT: { id: idForExclusion } } : {}),
        },
        data: { isPrimary: false },
      });
    }
  }
};

const extractCreateRow = (args: unknown): ContactRow | ContactRow[] | null => {
  if (!args || typeof args !== 'object') return null;
  const a = args as Record<string, unknown>;
  if (a.data) return a.data as ContactRow | ContactRow[];
  return a as ContactRow;
};

export const registerContactRulesHook = () => {
  registerDbHook(
    'contactRules:create',
    'Contact',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.upsert],
    async ({ args }) => {
      const data = extractCreateRow(args);
      if (!data) return;
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) await processContactRow(row, false);
    },
  );

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
      // shadow-merge previous + update so type-aware validation works on partial updates
      const merged: ContactRow = { ...(prev ?? {}), ...data };
      await processContactRow(merged, true, prev?.id as string | undefined);
      // Mirror computed fields back into the update payload so they persist.
      if (merged.valueKey !== undefined) data.valueKey = merged.valueKey;
      if (merged.value !== undefined && data.value !== undefined) data.value = merged.value;
    },
  );
};
