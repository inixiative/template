import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import type { Queue } from 'bullmq';

let boardInstance: any = null;

export const getBullBoard = (queues: { default: Queue }) => {
  if (!boardInstance) {
    boardInstance = createBullBoard({
      queues: [new BullMQAdapter(queues.default)],
      options: {
        uiConfig: {
          boardTitle: 'Queue Dashboard',
        },
      }
    });
  }
  return boardInstance.serverAdapter;
};