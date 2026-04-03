import { z } from 'zod';
import { makeAppEvent } from '#/events/makeAppEvent';

export const userVerificationRequestedEvent = makeAppEvent({
  type: 'user.verificationRequested',
  schema: z.object({
    userId: z.string(),
    verificationUrl: z.string(),
  }),
  email: async (event) => [
    {
      target: { userIds: [event.data.userId] },
      message: {
        template: 'email-verification',
        data: { verificationUrl: event.data.verificationUrl },
      },
      tags: ['auth', 'verification'],
      category: 'system' as const,
    },
  ],
});
