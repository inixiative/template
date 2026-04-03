import { registerAppEvent } from '#/events/registry';
import type { AppEventPayload } from '#/events/types';
import { sendToChannel, sendToUser } from '#/ws';

/**
 * Legacy wildcard WebSocket handler.
 *
 * Broadcasts all events to the actor and resource channel.
 * Events defined via makeAppEvent({ websocket: ... }) use targeted delivery
 * through the WS bridge instead. This handler provides backward compatibility
 * for events emitted via raw createAppEvent() without a websocket slot.
 *
 * TODO: Remove once all events are defined via makeAppEvent with explicit targeting.
 */
registerAppEvent('*', async (event: AppEventPayload) => {
  if (event.actor.actorUserId) {
    sendToUser(event.actor.actorUserId, event);
  }

  if (event.resourceType && event.resourceId) {
    sendToChannel(`${event.resourceType}:${event.resourceId}`, event);
  }
});
