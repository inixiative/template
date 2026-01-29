import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { serveStatic } from 'hono/bun';
import { isLocal } from '@template/shared/utils';
import { queue } from '#/jobs/queue';
import { log } from '@template/shared/logger';
import { basicAuthMiddleware } from '#/middleware/auth/basicAuthMiddleware';
import type { AppEnv } from '#/types/appEnv';

const hasCredentials = process.env.BULL_BOARD_USERNAME && process.env.BULL_BOARD_PASSWORD;

const createBullBoardRouter = (): OpenAPIHono<AppEnv> => {
  // Non-local requires auth credentials
  if (!isLocal && !hasCredentials) {
    log.warn('[BullBoard] No auth credentials configured - disabled. Set BULL_BOARD_USERNAME and BULL_BOARD_PASSWORD');
    return new OpenAPIHono<AppEnv>();
  }

  // Setup BullBoard (only reached if isLocal OR hasCredentials)
  const serverAdapter = new HonoAdapter(serveStatic);

  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter: serverAdapter as unknown as Parameters<typeof createBullBoard>[0]['serverAdapter'],
  });

  serverAdapter.setBasePath('/bullBoard');

  const router = serverAdapter.registerPlugin() as unknown as OpenAPIHono<AppEnv>;

  // Add auth for non-local (we know credentials exist if we're here and not local)
  if (!isLocal) {
    router.use(
      '*',
      basicAuthMiddleware(process.env.BULL_BOARD_USERNAME!, process.env.BULL_BOARD_PASSWORD!, 'BullBoard'),
    );
  }

  return router;
};

export default createBullBoardRouter();
