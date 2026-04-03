import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { registerAppEvent } from '#/events/registry';
import type { AppEventPayload } from '#/events/types';

/**
 * Observe bridge — persists every event to the AppEvent table.
 *
 * This is the base observability layer. Every event gets a durable record
 * with full actor context (auto-captured from auditActorContext), resource
 * reference, and domain payload.
 *
 * Future adapters (Segment, Datadog, Prometheus) can read from this table
 * or register as additional wildcard handlers alongside this one.
 */
registerAppEvent('*', async (event: AppEventPayload) => {
  try {
    await db.appEvent.create({
      data: {
        type: event.type,
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
  } catch (err) {
    log.error(`Observe bridge: failed to persist event=${event.type}`, { error: err });
  }
});
