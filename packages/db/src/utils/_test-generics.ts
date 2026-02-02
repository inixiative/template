import { Prisma, PrismaClient } from '../generated/client/client';
import type { ModelName } from './modelNames';

type Operation = 'findMany' | 'findFirst' | 'findUnique' | 'create' | 'update' | 'delete';

// ─────────────────────────────────────────────────────────────────────────────
// Test: Can TypeMap be indexed with a generic M?
// ─────────────────────────────────────────────────────────────────────────────

// Type-level mapping: Model + Operation → Args
type Args<M extends ModelName, Op extends Operation> = 
  Prisma.TypeMap['model'][M]['operations'][Op]['args'];

// Type-level mapping: Model + Operation → Result
type Result<M extends ModelName, Op extends Operation> = 
  Prisma.TypeMap['model'][M]['operations'][Op]['result'];

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Literal types resolve correctly
// ─────────────────────────────────────────────────────────────────────────────
type UserFindManyArgs = Args<'User', 'findMany'>;
type UserCreateResult = Result<'User', 'create'>;

// Verify: does UserFindManyArgs have 'where' with 'email'?
const testArgs: UserFindManyArgs = { where: { email: { contains: 'test' } } };

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Generic function with mapped types
// ─────────────────────────────────────────────────────────────────────────────
declare function query<M extends ModelName, Op extends Operation>(
  model: M,
  operation: Op,
  args: Args<M, Op>
): Promise<Result<M, Op>>;

// Does inference work?
async function testQuery() {
  const users = await query('User', 'findMany', { where: { email: 'x' } });
  //    ^? Should be User[] (Result<'User', 'findMany'>)
  
  const user = await query('User', 'create', { data: { name: 'Test', email: 'x' } });
  //    ^? Should be User (Result<'User', 'create'>)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Generic function that takes delegate directly
// ─────────────────────────────────────────────────────────────────────────────
type Delegate<M extends ModelName> = PrismaClient[Uncapitalize<M>];

declare function findMany<M extends ModelName>(
  delegate: Delegate<M>,
  args: Args<M, 'findMany'>
): Promise<Result<M, 'findMany'>>;

// Can we call with db.user and get inference?
declare const db: PrismaClient;
async function testDelegate() {
  const users = await findMany(db.user, { where: { email: 'test' } });
  //    ^? Should preserve User type
}

export {};
