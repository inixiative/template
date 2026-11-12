export const apiRouter = new OpenAPIHono();

apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
apiRouter.route('/v1/owner', ownerRouter);
apiRouter.use('*', jwtAuthMiddleware);
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.use('*', spoofMiddleware);
apiRouter.use('*', auditActorMiddleware);
apiRouter.use('*', apiRateLimit);
