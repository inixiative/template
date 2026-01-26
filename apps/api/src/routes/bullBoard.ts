import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { serveStatic } from 'hono/bun';
import { env } from '#/config/env';
import { queue } from '#/jobs/queue';
import { log } from '#/lib/logger';
import { basicAuthMiddleware } from '#/middleware/auth/basicAuthMiddleware';
import type { AppEnv } from '#/types/appEnv';

let bullBoardRoutes: OpenAPIHono<AppEnv>;

if (queue) {
  const serverAdapter = new HonoAdapter(serveStatic);

  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter: serverAdapter as unknown as Parameters<typeof createBullBoard>[0]['serverAdapter'],
  });

  serverAdapter.setBasePath('/bullBoard');

  bullBoardRoutes = serverAdapter.registerPlugin() as unknown as OpenAPIHono<AppEnv>;

  // Add basic auth protection if credentials are configured
  if (env.BULL_BOARD_USERNAME && env.BULL_BOARD_PASSWORD) {
    bullBoardRoutes.use('*', basicAuthMiddleware(env.BULL_BOARD_USERNAME, env.BULL_BOARD_PASSWORD, 'BullBoard'));
  } else if (env.isProd) {
    log.warn(
      '[BullBoard] ⚠️  No auth credentials configured in production! Set BULL_BOARD_USERNAME and BULL_BOARD_PASSWORD',
    );
  }
} else {
  log.info('[BullBoard] Jobs queue not configured - BullBoard UI disabled');
  bullBoardRoutes = new OpenAPIHono<AppEnv>();
}

export default bullBoardRoutes;
