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
import { makeError } from '#/lib/errors';

type TagRow = Partial<Prisma.TagGetPayload<Record<string, never>>> & Record<string, unknown>;

// Derived from the polymorphism registry — single source of truth.
const ownerKeyFields = [...new Set(Object.values(PolymorphismRegistry.Tag?.axes[0]?.fkMap ?? {}).flat())];

const ownerSelect: Record<string, true> = Object.fromEntries(ownerKeyFields.map((k) => [k, true]));

type CategoryOwner = { ownerModel: string } & Record<string, unknown>;

// A tag's owner must match its category's owner — both `ownerModel` and the
// FK that pairs with it. Complements the falsePolymorphism rule (which
// enforces "the discriminator and FKs on this row are internally consistent");
// this hook enforces "this row's owner matches its category's owner."
const validateRowAgainstCategory = (row: TagRow, category: CategoryOwner | undefined): void => {
  if (!category) {
    throw makeError({ status: 422, message: `TagCategory ${row.tagCategoryId} not found` });
  }

  // ownerModel has a DB default of 'platform' — apply it during validation so
  // creates that omit it match Prisma's post-default semantics.
  const ownerModel = (row.ownerModel as string | undefined) ?? 'platform';

  if (ownerModel !== category.ownerModel) {
    throw makeError({
      status: 422,
      message: `Tag.ownerModel (${ownerModel}) must match TagCategory.ownerModel (${category.ownerModel})`,
    });
  }

  for (const fk of ownerKeyFields) {
    const tagFk = (row[fk] as string | null | undefined) ?? null;
    const catFk = (category[fk] as string | null | undefined) ?? null;
    if (tagFk !== catFk) {
      throw makeError({
        status: 422,
        message: `Tag.${fk} (${String(tagFk)}) must match TagCategory.${fk} (${String(catFk)})`,
      });
    }
  }
};

// Batch-fetch every referenced TagCategory in one findMany, then validate
// rows against the in-memory map. Avoids N+1 on createManyAndReturn.
const validateRowsBatch = async (rows: TagRow[]): Promise<void> => {
  const ids = [...new Set(rows.map((r) => r.tagCategoryId).filter((id): id is string => typeof id === 'string'))];
  if (ids.length === 0) {
    // Each row will throw its own "not found" via the single-row path.
    for (const row of rows) validateRowAgainstCategory(row, undefined);
    return;
  }
  const categories = await db.tagCategory.findMany({
    where: { id: { in: ids } },
    select: { id: true, ownerModel: true, ...ownerSelect },
  });
  const byId = new Map<string, CategoryOwner>(categories.map((c) => [c.id as string, c as unknown as CategoryOwner]));
  for (const row of rows) {
    validateRowAgainstCategory(row, byId.get(row.tagCategoryId as string));
  }
};

const validateOwnerMatchesCategory = async (row: TagRow): Promise<void> => {
  const category = await db.tagCategory.findUnique({
    where: { id: row.tagCategoryId as string },
    select: { ownerModel: true, ...ownerSelect },
  });
  validateRowAgainstCategory(row, category ? (category as unknown as CategoryOwner) : undefined);
};

const extractCreateRows = (args: unknown): TagRow[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return Array.isArray(a.data) ? (a.data as TagRow[]) : [a.data as TagRow];
};

export const registerTagOwnerCategoryHook = () => {
  registerDbHook(
    'tagOwnerCategory:create',
    'Tag',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      const rows = extractCreateRows(args);
      if (rows.length === 0) return;
      await validateRowsBatch(rows);
    },
  );

  registerDbHook('tagOwnerCategory:upsert', 'Tag', HookTiming.before, [DbAction.upsert], async (options) => {
    const { args, previous } = options as HookOptions & { action: SingleAction };
    if (!args || typeof args !== 'object') return;
    const a = args as Record<string, unknown>;
    const create = a.create as TagRow | undefined;
    const update = a.update as TagRow | undefined;
    if (create) await validateOwnerMatchesCategory(create);
    if (update) {
      const prev = previous as TagRow | undefined;
      const merged: TagRow = { ...(prev ?? {}), ...update };
      await validateOwnerMatchesCategory(merged);
    }
  });

  registerDbHook(
    'tagOwnerCategory:update',
    'Tag',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous } = options as HookOptions & { action: SingleAction };
      if (!args || typeof args !== 'object') return;
      const a = args as Record<string, unknown>;
      const data = a.data as TagRow | undefined;
      if (!data) return;
      const prev = previous as TagRow | undefined;
      const merged: TagRow = { ...(prev ?? {}), ...data };
      await validateOwnerMatchesCategory(merged);
    },
  );
};
