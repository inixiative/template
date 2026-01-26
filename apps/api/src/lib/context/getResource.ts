import type { ExtendedPrismaClient } from '@template/db';
import type { Context } from 'hono';
import type { ResourcePayloadMap } from '#/middleware/resources/resourceContextInclusions';

type PrismaModelName = Exclude<keyof ExtendedPrismaClient, symbol | `$${string}`>;

type ResourceType<T extends PrismaModelName> = T extends keyof ResourcePayloadMap
  ? ResourcePayloadMap[T]
  : ExtendedPrismaClient[T] extends { findUnique: (args: any) => Promise<infer R> }
    ? NonNullable<R>
    : never;

export const getResource = <T extends PrismaModelName>(c: Context): ResourceType<T> => {
  return c.get('resource') as ResourceType<T>;
};

export const getResourceType = (c: Context): PrismaModelName | null => {
  return c.get('resourceType') as PrismaModelName | null;
};
