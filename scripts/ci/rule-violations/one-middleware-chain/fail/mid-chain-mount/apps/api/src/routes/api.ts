export const apiRouter = new OpenAPIHono();

apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
apiRouter.use('*', jwtAuthMiddleware);
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.get('/v1/peek', (c) => c.text('x'));
apiRouter.use('*', spoofMiddleware);
apiRouter.use('*', auditActorMiddleware);
apiRouter.use('*', apiRateLimit);
