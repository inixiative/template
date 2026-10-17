/**
 * @atlas
 * @kind channel
 * @partOf primitive:appEvents
 */
import type { WSHandoff } from '#/appEvents/types';
import { appendToStream, sendToChannel, sendToUser } from '#/ws/pubsub';

const deliver = (handoff: WSHandoff): Promise<void>[] => {
  switch (handoff.kind) {
    case 'stream':
      return [appendToStream(handoff.target.stream, handoff.append, handoff.target.userIds)];
    case 'channels':
      return handoff.target.channels.map((channel) => sendToChannel(channel, handoff.message.data));
    case 'users':
      return handoff.target.userIds.map((userId) => sendToUser(userId, handoff.message.data));
    default:
      throw new Error(
        `Unknown websocket handoff kind: ${(handoff satisfies never as { kind?: unknown }).kind}`,
      );
  }
};

export const deliverWSHandoffs = async (handoffs: WSHandoff[]): Promise<void> => {
  await Promise.all(handoffs.flatMap(deliver));
};
