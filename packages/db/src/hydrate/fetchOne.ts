import type { Db } from '@template/db/clientTypes';
import { cache, cacheKey } from '@template/db/redis';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import type { AccessorName } from '@template/db/utils/modelNames';
import type { Identifier } from '@template/db/utils/runtimeDataModel';
import type { HydratedRecord } from '@template/db/hydrate/types';

const DEFAULT_TTL = 60 * 60; // 1 hour

export const fetchOne = async <T extends HydratedRecord>(
  db: Db,
  accessor: AccessorName,
  identifier: Identifier,
  ttl: number = DEFAULT_TTL,
): Promise<T | null> => {
  const key = cacheKey(accessor, identifier);
  const delegate = db[accessor] as unknown as RuntimeDelegate;

  return cache<T | null>(
    key,
    async () => {
      const where = typeof identifier === 'string' ? { id: identifier } : identifier;
      return delegate.findFirst({ where }) as Promise<T | null>;
    },
    ttl,
  );
};
