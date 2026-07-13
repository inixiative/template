/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:observability, primitive:adapter
 * @uses primitive:appEvents, infrastructure:prisma
 */

import { db } from '@template/db';
import { makeBroadcastRegistry } from '@template/shared/adapter';
import { log } from '@template/shared/logger';
import type { ObserveAdapter } from '#/appEvents/types';

const createLogObserveAdapter = (): ObserveAdapter => ({
  record: (event) => {
    log.info(`appEvent ${event.name}`, { actor: event.actor, data: event.data });
    return Promise.resolve();
  },
});

const createDbObserveAdapter = (): ObserveAdapter => ({
  record: async (event) => {
    const {
      actorUserId,
      actorSpoofUserId,
      actorTokenId,
      actorJobName,
      ipAddress,
      userAgent,
      sourceInquiryId,
      integrationId,
    } = event.actor;
    await db.appEvent.upsert({
      where: { id: event.id },
      update: {},
      create: {
        id: event.id,
        name: event.name,
        actorUserId,
        actorSpoofUserId,
        actorTokenId,
        actorJobName,
        ipAddress,
        userAgent,
        sourceInquiryId,
        integrationId,
        data: event.data as object,
      },
    });
  },
});

export const observeRegistry = makeBroadcastRegistry<ObserveAdapter>();

observeRegistry.register('log', createLogObserveAdapter());
observeRegistry.register('db', createDbObserveAdapter());
