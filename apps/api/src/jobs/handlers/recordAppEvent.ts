/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses primitive:appEvents, infrastructure:prisma
 */
import { log } from '@template/shared/logger';
import type { AppEventActor, ObserveData } from '#/appEvents/types';
import { makeJob } from '#/jobs/makeJob';

export type RecordAppEventPayload = {
  id: string;
  name: string;
  actor: AppEventActor;
  data: ObserveData;
};

export const recordAppEvent = makeJob<RecordAppEventPayload>(async (ctx, payload) => {
  const { id, name, actor, data } = payload;
  const { db } = ctx;

  await db.appEvent.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name,
      actorUserId: actor.actorUserId,
      actorSpoofUserId: actor.actorSpoofUserId,
      actorTokenId: actor.actorTokenId,
      actorJobName: actor.actorJobName,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      sourceInquiryId: actor.sourceInquiryId,
      data: data as object,
    },
  });

  log.info(`Recorded event: ${name}`);
});
