import { db } from '@template/db';
import { makeBroadcastRegistry } from '@template/shared/adapter';
import type { AppEventPayload, ObserveAdapter, ObserveData } from '#/appEvents/types';

const createDbObserveAdapter = (): ObserveAdapter => ({
  record: async (event: AppEventPayload, data: ObserveData) => {
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
        data: data as object,
      },
    });
  },
});

export const observeRegistry = makeBroadcastRegistry<ObserveAdapter>();

observeRegistry.register('db', createDbObserveAdapter());
