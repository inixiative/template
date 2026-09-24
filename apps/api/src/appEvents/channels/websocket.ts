/**
 * @atlas
 * @kind channel
 * @partOf primitive:appEvents
 */
import type { WSHandoff } from '#/appEvents/types';
import { appendToStream, sendToChannel, sendToUser } from '#/ws/pubsub';

const deliver = (handoff: WSHandoff): Promise<void>[] => {
  if ('append' in handoff) return [appendToStream(handoff.target.stream, handoff.append, handoff.target.userIds)];
  if ('channels' in handoff.target)
    return handoff.target.channels.map((channel) => sendToChannel(channel, handoff.message.data));
  return handoff.target.userIds.map((userId) => sendToUser(userId, handoff.message.data));
};

export const deliverWSHandoffs = async (handoffs: WSHandoff[]): Promise<void> => {
  await Promise.all(handoffs.flatMap(deliver));
};
