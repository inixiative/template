/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses primitive:authz
 */

import type { Context } from 'hono';
import { pickBy } from 'lodash-es';
import { pseudoRecordOfSubmodel } from '#/lib/permissions/pseudoRecordOfSubmodel';
import type { AppEnv } from '#/types/appEnv';

export const submodelOwnerWhere = (c: Context<AppEnv>): Record<string, string> =>
  pickBy(pseudoRecordOfSubmodel(c).pseudoRecord, (value) => typeof value === 'string') as Record<
    string,
    string
  >;
