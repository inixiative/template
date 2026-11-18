/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { pickColumns } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { sensitiveFieldsOf } from '@template/db/registries/sensitiveFields';
import type { Actor, ActorModel } from '@template/permissions/client';
import { omit } from 'lodash-es';

export const actorFromRecordOmittingSensitiveFields = (
  model: ActorModel,
  record: Record<string, unknown>,
): Actor => ({
  model,
  record: omit(pickColumns(prismaMap, model, record), sensitiveFieldsOf(model)),
});
