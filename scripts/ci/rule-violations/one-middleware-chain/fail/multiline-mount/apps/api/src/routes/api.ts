export const apiRouter = new OpenAPIHono();

apiRouter.use('*', corsMiddleware);
apiRouter.use('*', prepareRequest);
apiRouter
  .route('/v1/early', earlyRouter);
apiRouter.all('/auth/*', (c) => auth.handler(c.req.raw));
// apiRouter.route('/v1/commented', commentedRouter);
apiRouter.use('*', jwtAuthMiddleware);
apiRouter.use('*', tokenAuthMiddleware);
apiRouter.use('*', spoofMiddleware);
apiRouter.use('*', auditActorMiddleware);
apiRouter.use('*', apiRateLimit);

apiRouter.route('/admin', adminRouter);
apiRouter.route('/v1/user', userRouter);
