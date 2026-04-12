import type { WSHandoff } from '#/appEvents/types';
import { sendToChannel, sendToUser } from '#/ws';

// ARCHITECTURAL SKETCH — NOT PRODUCTION READY.
// This bridge is an AI-drafted stub. Before any real feature work depends on it,
// the targeting model, message envelope, and delivery semantics (fan-out rules,
// auth/permission checks on channels, dedupe, ordering, retries, acks) need a
// human architectural pass to pin down the canonical pattern.
export const deliverWSHandoffs = async (handoffs: WSHandoff[]): Promise<void> => {
  for (const handoff of handoffs) {
    const payload = { type: handoff.message.type, ...handoff.message.data };

    if ('channels' in handoff.target) {
      for (const channel of handoff.target.channels) {
        sendToChannel(channel, payload);
      }
    }

    if ('userIds' in handoff.target) {
      for (const userId of handoff.target.userIds) {
        sendToUser(userId, payload);
      }
    }
  }
};
