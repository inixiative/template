import type { WSHandoff } from '#/appEvents/types';
import { sendToChannel, sendToUser } from '#/ws';

export const deliverWSHandoffs = async (handoffs: WSHandoff[]): Promise<void> => {
  for (const handoff of handoffs) {
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
  }
};
