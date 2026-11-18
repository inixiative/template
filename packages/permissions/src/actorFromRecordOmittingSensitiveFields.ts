/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { sensitiveFieldsOf } from '@template/db/registries/sensitiveFields';
import { pickColumns } from '@template/db/utils/pickColumns';
import type { Actor, ActorModel } from '@template/permissions/client';
import { omit } from 'lodash-es';

export const actorFromRecordOmittingSensitiveFields = (
  model: ActorModel,
  record: Record<string, unknown>,
): Actor => ({
  model,
  record: omit(pickColumns(model, record), sensitiveFieldsOf(model)),
});
