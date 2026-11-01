/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses primitive:authz
 */

import type { Context } from 'hono';
import { pickBy } from 'lodash-es';
import { placeSubmodel } from '#/lib/permissions/placeSubmodel';
import type { AppEnv } from '#/types/appEnv';

export const submodelOwnerWhere = (c: Context<AppEnv>): Record<string, string> =>
  pickBy(placeSubmodel(c).placed, (value) => typeof value === 'string') as Record<string, string>;
