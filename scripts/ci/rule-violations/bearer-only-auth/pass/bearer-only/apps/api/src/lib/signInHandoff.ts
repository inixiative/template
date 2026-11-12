export const endHandshake = async (ctx, newSession) => {
  await ctx.context.internalAdapter.deleteSession(newSession.session.token);
};
