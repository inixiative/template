import { db } from '@template/db';
import { registerAppEvent } from '#/appEvents/registry';
import type { AppEventPayload } from '#/appEvents/types';

registerAppEvent('*', async (event: AppEventPayload) => {
  await db.appEvent.create({
    data: {
      name: event.name,
      actorUserId: event.actor.actorUserId,
      actorSpoofUserId: event.actor.actorSpoofUserId,
      actorTokenId: event.actor.actorTokenId,
      actorJobName: event.actor.actorJobName,
      ipAddress: event.actor.ipAddress,
      userAgent: event.actor.userAgent,
      sourceInquiryId: event.actor.sourceInquiryId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      data: event.data as object,
    },
  });
});
