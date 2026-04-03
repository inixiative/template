import { z } from 'zod';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

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
        data: {
          buttonUrl: event.data.verificationUrl,
          buttonText: 'Verify Email',
        },
      },
      tags: ['auth', 'verification'],
      category: 'system' as const,
    },
  ],
});
