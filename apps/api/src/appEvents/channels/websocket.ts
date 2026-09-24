/**
 * @atlas
 * @kind channel
 * @partOf primitive:appEvents
 */
import type { WSHandoff } from '#/appEvents/types';
import { appendToStream, sendToChannel, sendToUser } from '#/ws/pubsub';

export const deliverWSHandoffs = async (handoffs: WSHandoff[]): Promise<void> => {
  await Promise.all(
    handoffs.flatMap((handoff) => [
      ...('channels' in handoff.target
        ? handoff.target.channels.map((channel) => sendToChannel(channel, handoff.message.data))
        : []),
      ...('userIds' in handoff.target
        ? handoff.target.userIds.map((userId) => sendToUser(userId, handoff.message.data))
        : []),
      ...('streams' in handoff.target
        ? handoff.target.streams.map((stream) => appendToStream(stream, handoff.message.data))
        : []),
    ]),
  );
};
