export const apiRouter = new OpenAPIHono();

apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequestMiddleware);
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
apiRouter.use('*', jwtAuthMiddleware);
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.use('*', auditActorMiddleware);
apiRouter.use('*', apiRateLimit);
