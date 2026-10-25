/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { getRedactFields } from '@template/db/registries/redactFields';
import type { Actor, ActorModel } from '@template/permissions/client';
import { omit } from 'lodash-es';

export const actorOf = (model: ActorModel, record: Record<string, unknown>): Actor => ({
  model,
  record: omit(record, getRedactFields(model)),
});
