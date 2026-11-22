/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { columnsARuleReadsOfActor } from '@template/db/schemaMap';
import type { Actor, ActorModel } from '@template/permissions/client';
import { pick } from 'lodash-es';

export const actorFromRecordOmittingSensitiveFields = (
  model: ActorModel,
  record: Record<string, unknown>,
): Actor => ({ model, record: pick(record, columnsARuleReadsOfActor(model)) });
