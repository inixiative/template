import { z } from 'zod';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export const userCreatedEvent = makeAppEvent({
  type: 'user.created',
  schema: z.object({
    userId: z.string(),
    isGuest: z.boolean().default(false),
  }),
  email: async (event) => [
    {
      target: { userIds: [event.data.userId] },
      message: {
        template: 'welcome',
        data: { isGuest: event.data.isGuest },
      },
      tags: ['user', 'welcome'],
      category: 'system' as const,
    },
  ],
});
