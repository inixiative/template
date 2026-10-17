/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses none
 */
import type {
  RuleReferenceSourceModel,
  RuleReferenceTargetModel,
} from '@template/db/generated/client/enums';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type RuleReferenceStalePayload = {
  sourceModel: RuleReferenceSourceModel;
  sourceId: string;
  targetModel: RuleReferenceTargetModel;
  targetId: string;
  targetDeletedAt: Date;
};

export const ruleReferenceStale = makeAppEvent<RuleReferenceStalePayload>({});
