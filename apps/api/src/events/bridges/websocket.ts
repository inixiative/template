import { log } from '@template/shared/logger';
import type { WSHandoff } from '#/events/types';
import { sendToChannel, sendToUser } from '#/ws';

export const deliverWSHandoffs = async (handoffs: WSHandoff[]): Promise<void> => {
  for (const handoff of handoffs) {
    try {
      if ('channels' in handoff.target) {
        for (const channel of handoff.target.channels) {
          sendToChannel(channel, handoff.message.data);
        }
      }

      if ('userIds' in handoff.target) {
        for (const userId of handoff.target.userIds) {
          sendToUser(userId, handoff.message.data);
        }
      }
    } catch (err) {
      log.error('WebSocket bridge failed', { error: err });
    }
  }
};
