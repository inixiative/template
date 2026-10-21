/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses infrastructure:redis
 */
import { db } from '@template/db/client';
import type { HydratedRecord } from '@template/db/hydrate/types';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { cache, cacheKey } from '@template/db/redis';
import type { AccessorName } from '@template/db/utils/modelNames';
import type { Identifier } from '@template/db/utils/prismaMapRelations';

const DEFAULT_TTL = 60 * 60; // 1 hour

export const fetchOne = async <T extends HydratedRecord>(
  accessor: AccessorName,
  identifier: Identifier,
  ttl: number = DEFAULT_TTL,
): Promise<T | null> => {
  const key = cacheKey(accessor, identifier);
  const delegate = db.delegate(accessor);

  const where = typeof identifier === 'string' ? { id: identifier } : identifier;
  const read = () => delegate.findFirst({ where }) as Promise<T | null>;

  // why: a withDeleted read may return a tombstone, which must never land under the shared live key.
  if (auditActorContext.isSoftDeleteBypassed()) return read();
  return cache<T | null>(key, read, ttl);
};
