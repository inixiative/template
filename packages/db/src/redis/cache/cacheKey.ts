/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching, infrastructure:redis
 * @uses infrastructure:prisma
 */
import { redisNamespace } from '@template/db/redis/namespaces';
import {
  type AccessorName,
  isModelName,
  type ModelName,
  toAccessor,
} from '@template/db/utils/modelNames';
import { compact } from 'lodash-es';

type Identifier = string | Record<string, string>;

type CacheDomain = AccessorName | ModelName | (string & {});

const toAccessorName = (domain: CacheDomain): string =>
  isModelName(domain) ? toAccessor(domain) : domain;

export const cacheKey = (
  domain: CacheDomain,
  identifier: Identifier,
  tags: string[] = [],
  wildcard = false,
): string => {
  const idParts: string[] = [];

  if (typeof identifier === 'string') {
    idParts.push('id', identifier);
  } else {
    const pairs = Object.entries(identifier).sort(([a], [b]) => a.localeCompare(b));
    for (const [field, value] of pairs) {
      idParts.push(field, value);
    }
  }

  return compact([
    redisNamespace.cache,
    toAccessorName(domain),
    ...idParts,
    ...tags,
    wildcard && '*',
  ]).join(':');
};
