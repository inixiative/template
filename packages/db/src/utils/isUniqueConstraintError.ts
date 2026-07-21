/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Prisma } from '@template/db/generated/client/client';

// Duck-types on `code` rather than instanceof so it matches however the Prisma error surfaces (raw client, extended client, or wrapped transaction error).
export const isUniqueConstraintError = (
  err: unknown,
): err is Prisma.PrismaClientKnownRequestError & { code: 'P2002' } =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'P2002';
