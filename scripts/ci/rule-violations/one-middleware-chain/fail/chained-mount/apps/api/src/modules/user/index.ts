export const userRouter = new OpenAPIHono();
userRouter.use('*', validateActor);
