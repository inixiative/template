export const apiRouter = new OpenAPIHono();

apiRouter.use('*', prepareRequest);
apiRouter.use('*', corsMiddleware);
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
apiRouter.use('*', jwtAuthMiddleware);
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.use('*', spoofMiddleware);
apiRouter.use('*', auditActorMiddleware);
apiRouter.use('*', apiRateLimit);
