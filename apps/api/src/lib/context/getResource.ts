import type { AccessorName, ModelName, ModelTypeMap } from '@template/db';
import type { Context } from 'hono';
import type { ResourcePayloadMap } from '#/middleware/resources/resourceContextArgs';

type ResourceType<T extends AccessorName> = T extends keyof ResourcePayloadMap
  ? ResourcePayloadMap[T]
  : Capitalize<T> extends ModelName
    ? ModelTypeMap[Capitalize<T>]
    : never;

export const getResource = <T extends AccessorName>(c: Context): ResourceType<T> => {
  return c.get('resource') as ResourceType<T>;
};

export const getResourceType = (c: Context): AccessorName | null => {
  return c.get('resourceType') as AccessorName | null;
};
