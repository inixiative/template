/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Prisma } from '@template/db/generated/client/client';

// P2034 rolls the deadlock/serialization victim back whole and exactly one contender wins, so a first-create race can treat it like P2002: the winner committed, re-read it.
export const isWriteConflictError = (err: unknown): err is Prisma.PrismaClientKnownRequestError & { code: 'P2034' } =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'P2034';
