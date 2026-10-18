export const apiRouter = new OpenAPIHono();

apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
for (const [path, router] of selfAuthenticated) apiRouter.route(path, router);
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.use('*', authMiddleware);
apiRouter.use('*', spoofMiddleware);
apiRouter.use('*', auditActorMiddleware);
apiRouter.use('*', apiRateLimit);
