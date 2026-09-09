/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma
 * @uses none
 */

// Everything we know about Prisma's own transaction identity. Its public extension params do not
// say which transaction an op is executing on; __internalParams does, and unlike async-local
// storage it survives the interceptor's continuation. Pinned by test/managedTransactions.test.ts.
export type PrismaTransaction = { kind: string; id: string | number };

export const readPrismaTransaction = (params: unknown): PrismaTransaction | undefined =>
  (params as { __internalParams?: { transaction?: PrismaTransaction } }).__internalParams?.transaction;
