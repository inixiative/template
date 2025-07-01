import { Elysia } from 'elysia';
import { errorBoundary } from 'src/app/core/middleware/errorBoundary';
import { exampleMiddleware } from 'src/app/core/middleware/example';
import { userContext } from 'src/app/core/middleware/user/userContext';
import { resourceContext } from 'src/app/core/middleware/resource/resourceContext';

export const middleware = (app: Elysia) => {
  app.use(errorBoundary);
  app.use(userContext);
  app.use(resourceContext);
  
  // if (process.env.EXAMPLE_MIDDLEWARE_ENABLED) app.use(exampleMiddleware);
  
  return app;
};
