import { DbAction, db, type HookOptions, HookTiming, registerDbHook, type SingleAction } from '@template/db';
import { ContactRegistry } from '@template/shared/contact';
import { HTTPException } from 'hono/http-exception';

type ContactRow = Record<string, unknown> & {
  type?: string;
  value?: unknown;
  subtype?: string | null;
  isPrimary?: boolean;
  ownerModel?: string;
  userId?: string | null;
  organizationId?: string | null;
  spaceId?: string | null;
};

const ownerKeyFields = ['userId', 'organizationId', 'spaceId'] as const;

const ownerWhereFromRow = (row: ContactRow) => ({
  userId: row.userId ?? null,
  organizationId: row.organizationId ?? null,
  spaceId: row.spaceId ?? null,
});

// Validate + normalize a single Contact row in place. The row mutation makes
// `valueKey` and the canonical `value` shape persist when Prisma writes.
const processContactRow = async (row: ContactRow, isUpdate: boolean, idForExclusion?: string): Promise<void> => {
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
  // absent on update (caller is updating a different field).
  if (row.value !== undefined) {
    const parsedInput = def.inputSchema.safeParse(row.value);
    if (!parsedInput.success) {
      throw new HTTPException(422, { message: `Invalid Contact.value for type '${row.type}': ${parsedInput.error.message}` });
    }
    let canonical: unknown;
    try {
      canonical = def.parseInput(parsedInput.data);
    } catch (e) {
      throw new HTTPException(422, { message: `Could not normalize Contact.value: ${(e as Error).message}` });
    }
    const validated = def.valueSchema.safeParse(canonical);
    if (!validated.success) {
      throw new HTTPException(422, { message: `Normalized Contact.value failed schema: ${validated.error.message}` });
    }
    row.value = validated.data;
    row.valueKey = def.toValueKey(validated.data);

    // Global-within-type uniqueness pre-check (for clean 409s; partial unique
    // index will be the eventual backstop once we cut migrations).
    if (def.uniqueness === 'global-within-type') {
      const collision = await db.contact.findFirst({
        where: {
          type: row.type as never,
          valueKey: row.valueKey as string,
          deletedAt: null,
          ...(idForExclusion ? { NOT: { id: idForExclusion } } : {}),
        },
        select: { id: true },
      });
      if (collision) {
        throw new HTTPException(409, {
          message: `A Contact with type '${row.type}' and value already exists.`,
        });
      }
    }
  }

  // isPrimary uniqueness per (owner, type) — clear other primaries before this row sticks.
  if (row.isPrimary === true && row.type) {
    const ownerWhere = ownerWhereFromRow(row);
    if (ownerKeyFields.some((k) => ownerWhere[k] !== null)) {
      await db.contact.updateManyAndReturn({
        where: {
          ...ownerWhere,
          type: row.type as never,
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
