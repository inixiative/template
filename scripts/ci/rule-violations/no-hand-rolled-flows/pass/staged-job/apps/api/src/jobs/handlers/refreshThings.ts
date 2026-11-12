import { makeJob } from '#/jobs/makeJob';

export const refreshThings = makeJob<{ ids: string[] }>({
  stages: [
    async (ctx, { ids }) => {
      for (const id of ids) await ctx.enqueueChildJob('refreshThing' as never, { id } as never);
    },
  ],
  finish: async () => {},
});
