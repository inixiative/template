import { registerAppEvent } from '#/events/registry';
import type { AppEventPayload } from '#/events/types';
import { sendToChannel, sendToUser } from '#/ws';

registerAppEvent('*', async (event: AppEventPayload) => {
  // Send to actor (the user who triggered the event)
  if (event.actorId) {
    sendToUser(event.actorId, event);
  }

  // Send to resource channel (e.g., "Inixiative:abc-123")
  if (event.resourceType && event.resourceId) {
    sendToChannel(`${event.resourceType}:${event.resourceId}`, event);
  }
});
