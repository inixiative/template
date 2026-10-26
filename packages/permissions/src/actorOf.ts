/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { getRedactFields } from '@template/db/registries/redactFields';
import { pickColumns } from '@template/db/utils/pickColumns';
import type { Actor, ActorModel } from '@template/permissions/client';
import { omit } from 'lodash-es';

export const actorOf = (model: ActorModel, record: Record<string, unknown>): Actor => ({
  model,
  record: omit(pickColumns(model, record), getRedactFields(model)),
});
