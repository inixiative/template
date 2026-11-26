/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma, primitive:shared, primitive:errors
 */
import { fieldOf, isScalarField } from '@inixiative/field-map';
import {
  type AccessorName,
  db,
  INTERNAL_FIELDS,
  isAccessorName,
  sensitiveFieldsOf,
  toModelName,
} from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { isUuidV7 } from '@template/shared/utils';
import type { MiddlewareHandler } from 'hono';
import { makeError } from '#/lib/errors';
import { resourceContextArgs } from '#/middleware/resources/resourceContextArgs';

const isAllowedLookupField = (accessor: AccessorName, lookup: string): boolean => {
  const modelName = toModelName(accessor);
  const field = fieldOf(prismaMap, modelName, lookup);
  if (!field || !isScalarField(field) || field.isList || field.type !== 'String') return false;
  return (
    !sensitiveFieldsOf(modelName).includes(lookup) &&
    !(INTERNAL_FIELDS[modelName] ?? []).includes(lookup)
  );
};

export const resourceContextMiddleware = (): MiddlewareHandler => async (c, next) => {
  const id = c.req.param('id');
  if (!id) return next();

  const lookup = c.req.query('lookup') || 'id';

  if (lookup === 'id' && !isUuidV7(id)) {
    throw makeError({
      status: 400,
      message: 'id must be a uuidv7 (or pass `?lookup=<field>` to address by another column)',
    });
  }

  const pathParts = c.req.path.split('/');
  const accessor = pathParts[3];
  if (!accessor || !isAccessorName(accessor)) return next();

  if (lookup !== 'id' && !isAllowedLookupField(accessor, lookup)) {
    throw makeError({ status: 400, message: `Invalid lookup field: ${lookup}` });
  }

  const resources = await findResources(accessor, { [lookup]: id });

  if (!resources.length) throw makeError({ status: 404, message: 'Resource not found' });
  if (resources.length > 1) throw makeError({ status: 409, message: 'Multiple resources found' });

  c.set('resource', resources[0]);
  c.set('resourceType', accessor);

  return next();
};

const findResources = async (accessor: AccessorName, where: Record<string, unknown>) => {
  const delegate = db[accessor] as
    | { findMany: (...args: unknown[]) => Promise<unknown[]> }
    | undefined;
  if (!delegate?.findMany) return [];

  return delegate.findMany({ where, ...resourceContextArgs[accessor] });
};
