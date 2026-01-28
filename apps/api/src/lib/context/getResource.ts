import type { ExtendedPrismaClient, ModelDelegate } from '@template/db';
import type { Context } from 'hono';
import type { ResourcePayloadMap } from '#/middleware/resources/resourceContextArgs';

type ResourceType<T extends ModelDelegate> = T extends keyof ResourcePayloadMap
  ? ResourcePayloadMap[T]
  : ExtendedPrismaClient[T] extends { findUnique: (args: object) => Promise<infer R> }
    ? NonNullable<R>
    : never;

export const getResource = <T extends ModelDelegate>(c: Context): ResourceType<T> => {
  return c.get('resource') as ResourceType<T>;
};

export const getResourceType = (c: Context): ModelDelegate | null => {
  return c.get('resourceType') as ModelDelegate | null;
};
