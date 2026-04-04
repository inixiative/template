import type { AppEventActor, ObserveData } from '#/appEvents/types';
import { makeJob } from '#/jobs/makeJob';

export type RecordAppEventPayload = {
  name: string;
  actor: AppEventActor;
  resourceType?: string;
  resourceId?: string;
  data: ObserveData;
};

export const recordAppEvent = makeJob<RecordAppEventPayload>(async (ctx, payload) => {
  const { name, actor, data, resourceType, resourceId } = payload;
  const { db, log } = ctx;

  await db.appEvent.create({
    data: {
      name,
      actorUserId: actor.actorUserId,
      actorSpoofUserId: actor.actorSpoofUserId,
      actorTokenId: actor.actorTokenId,
      actorJobName: actor.actorJobName,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      sourceInquiryId: actor.sourceInquiryId,
      resourceType,
      resourceId,
      data: data as object,
    },
  });

  log(`Recorded event: ${name}`);
});
