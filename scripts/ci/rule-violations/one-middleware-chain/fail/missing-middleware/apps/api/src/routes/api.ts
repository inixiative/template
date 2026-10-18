export const apiRouter = new OpenAPIHono();

apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.use('*', authMiddleware);
apiRouter.use('*', auditActorMiddleware);
apiRouter.use('*', apiRateLimit);
