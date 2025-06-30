import { Elysia } from 'elysia';
import { errorBoundary } from 'src/app/core/middleware/errorBoundary';
import { exampleMiddleware } from 'src/app/core/middleware/example';

export const middleware = (app: Elysia) => {
  app.use(errorBoundary);
  
  // if (process.env.EXAMPLE_MIDDLEWARE_ENABLED) app.use(exampleMiddleware);
  
  return app;
};
