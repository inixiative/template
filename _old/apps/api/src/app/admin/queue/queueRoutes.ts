import { Elysia, t } from 'elysia';
import { getBullBoard } from 'src/app/admin/queue/controllers/bullBoardController.ts';

export const queueRoutes = new Elysia({ prefix: '/queues' })
  .guard({
    beforeHandle({ queues, error }) {
      if (!queues?.default) return error(503, 'Queue service not available');
    }
  })
  .get('/*', ({ queues }) => {
    const serverAdapter = getBullBoard(queues);
    return serverAdapter.getRouter();
  });
