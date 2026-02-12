import type { Prisma } from '@template/db/generated/client/client';

/** Operation type for Prisma delegates */
export type Operation =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findMany'
  | 'create'
  | 'createMany'
  | 'createManyAndReturn'
  | 'update'
  | 'updateMany'
  | 'updateManyAndReturn'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'count'
  | 'aggregate'
  | 'groupBy';

// Re-export Prisma's type utilities for convenience
export type Args<T, Op extends Operation> = Prisma.Args<T, Op>;
export type Result<T, A, Op extends Operation> = Prisma.Result<T, A, Op>;

// ─────────────────────────────────────────────────────────────────────────────
// Pass-the-Delegate Pattern
//
// Pass the delegate directly and TypeScript infers the exact type.
// See docs/claude/DATABASE.md#delegate-typing for details.
//
// Usage:
//   const users = await query.findMany(db.user, { where: { email: 'x' } });
//   //    ^? User[] - full type inference!
// ─────────────────────────────────────────────────────────────────────────────

// Base constraint for delegates with specific operations
type HasFindFirst = { findFirst: (args: any) => Promise<any> };
type HasFindUnique = { findUnique: (args: any) => Promise<any> };
type HasFindMany = { findMany: (args: any) => Promise<any> };
type HasCreate = { create: (args: any) => Promise<any> };
type HasUpdate = { update: (args: any) => Promise<any> };
type HasDelete = { delete: (args: any) => Promise<any> };
type HasCount = { count: (args?: any) => Promise<any> };

/** Any Prisma delegate that supports standard read operations */
export type AnyDelegate = HasFindFirst & HasFindUnique & HasFindMany & HasCount;

/** Any Prisma delegate that supports all CRUD operations */
export type AnyCrudDelegate = AnyDelegate & HasCreate & HasUpdate & HasDelete;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Delegate Access (when model name is only known at runtime)
// ─────────────────────────────────────────────────────────────────────────────

type Record_ = Record<string, unknown>;

// Structural arg types that match Prisma's expected shapes
type WhereInput = Record<string, unknown>;
type DataInput = Record<string, unknown>;
type SelectInput = Record<string, boolean | object>;
type IncludeInput = Record<string, boolean | object>;
type OrderByInput = Record<string, unknown> | Array<Record<string, unknown>>;

type FindArgs = {
  where?: WhereInput;
  select?: SelectInput;
  include?: IncludeInput;
  orderBy?: OrderByInput;
  take?: number;
  skip?: number;
  cursor?: WhereInput;
  distinct?: string[];
};

type FindUniqueArgs = {
  where: WhereInput;
  select?: SelectInput;
  include?: IncludeInput;
};

type CreateArgs = {
  data: DataInput;
  select?: SelectInput;
  include?: IncludeInput;
};

type UpdateArgs = {
  where: WhereInput;
  data: DataInput;
  select?: SelectInput;
  include?: IncludeInput;
};

type UpsertArgs = {
  where: WhereInput;
  create: DataInput;
  update: DataInput;
  select?: SelectInput;
  include?: IncludeInput;
};

type DeleteArgs = {
  where: WhereInput;
  select?: SelectInput;
  include?: IncludeInput;
};

type CountArgs = {
  where?: WhereInput;
  cursor?: WhereInput;
  take?: number;
  skip?: number;
  orderBy?: OrderByInput;
};

/** Full delegate interface for runtime access (hooks, hydration, factories, etc.) */
export type RuntimeDelegate = {
  findFirst: (args?: FindArgs) => Promise<Record_ | null>;
  findFirstOrThrow: (args?: FindArgs) => Promise<Record_>;
  findUnique: (args: FindUniqueArgs) => Promise<Record_ | null>;
  findUniqueOrThrow: (args: FindUniqueArgs) => Promise<Record_>;
  findMany: (args?: FindArgs) => Promise<Record_[]>;
  create: (args: CreateArgs) => Promise<Record_>;
  createManyAndReturn: (args: { data: DataInput[] }) => Promise<Record_[]>;
  update: (args: UpdateArgs) => Promise<Record_>;
  updateManyAndReturn: (args: { where?: WhereInput; data: DataInput }) => Promise<Record_[]>;
  upsert: (args: UpsertArgs) => Promise<Record_>;
  delete: (args: DeleteArgs) => Promise<Record_>;
  deleteMany: (args?: { where?: WhereInput }) => Promise<{ count: number }>;
  count: (args?: CountArgs) => Promise<number>;
};

/**
 * Type-safe query helpers that infer types from the delegate passed.
 *
 * @example
 * ```typescript
 * import { query } from '@template/db';
 *
 * // Full type inference - no generics needed
 * const user = await query.findFirst(db.user, { where: { email: 'test@example.com' } });
 * //    ^? User | null
 *
 * const users = await query.findMany(db.user, { where: { role: 'admin' } });
 * //    ^? User[]
 *
 * const org = await query.create(db.organization, { data: { name: 'Acme' } });
 * //    ^? Organization
 * ```
 */
export const query = {
  findFirst: <T extends HasFindFirst>(
    delegate: T,
    args: Prisma.Args<T, 'findFirst'>,
  ): Promise<Prisma.Result<T, typeof args, 'findFirst'>> => delegate.findFirst(args),

  findUnique: <T extends HasFindUnique>(
    delegate: T,
    args: Prisma.Args<T, 'findUnique'>,
  ): Promise<Prisma.Result<T, typeof args, 'findUnique'>> => delegate.findUnique(args),

  findMany: <T extends HasFindMany>(
    delegate: T,
    args?: Prisma.Args<T, 'findMany'>,
  ): Promise<Prisma.Result<T, typeof args, 'findMany'>> => delegate.findMany(args),

  create: <T extends HasCreate>(
    delegate: T,
    args: Prisma.Args<T, 'create'>,
  ): Promise<Prisma.Result<T, typeof args, 'create'>> => delegate.create(args),

  update: <T extends HasUpdate>(
    delegate: T,
    args: Prisma.Args<T, 'update'>,
  ): Promise<Prisma.Result<T, typeof args, 'update'>> => delegate.update(args),

  delete: <T extends HasDelete>(
    delegate: T,
    args: Prisma.Args<T, 'delete'>,
  ): Promise<Prisma.Result<T, typeof args, 'delete'>> => delegate.delete(args),

  count: <T extends HasCount>(
    delegate: T,
    args?: Prisma.Args<T, 'count'>,
  ): Promise<Prisma.Result<T, typeof args, 'count'>> => delegate.count(args),
};

// ─────────────────────────────────────────────────────────────────────────────
// Standalone typed functions (alternative to query.*)
// ─────────────────────────────────────────────────────────────────────────────

export const findFirst = query.findFirst;
export const findUnique = query.findUnique;
export const findMany = query.findMany;
export const create = query.create;
export const update = query.update;
export const del = query.delete; // 'delete' is reserved
export const count = query.count;
