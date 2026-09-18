/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses none
 */
import type { RuleReferenceOwnerModel, RuleReferenceReferencedModel } from '@template/db/generated/client/enums';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type RuleReferenceStalePayload = {
  ownerModel: RuleReferenceOwnerModel;
  ownerId: string;
  referencedModel: RuleReferenceReferencedModel;
  referencedId: string;
  referencedDeletedAt: Date;
};

export const ruleReferenceStale = makeAppEvent<RuleReferenceStalePayload>({});
