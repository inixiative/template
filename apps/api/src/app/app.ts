import { base } from 'src/base.ts'
import { middleware } from 'src/app/core/middleware';
import { apiRoutes } from 'src/app/apiRoutes';

export const app = base
  .use(middleware)
  .use(apiRoutes)
  .get('/health', (context) => {
    console.log('Context keys:', Object.keys(context));
    // console.log('Context:', context);
    return { status: 'ok', context_keys: Object.keys(context) };
  })
