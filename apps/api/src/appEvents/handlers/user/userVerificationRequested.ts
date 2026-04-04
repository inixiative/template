import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserVerificationRequestedPayload = {
  userId: string;
  verificationUrl: string;
};

makeAppEvent<UserVerificationRequestedPayload>('user.verificationRequested', {
  email: (data) => [
    {
      target: { userIds: [data.userId] },
      message: {
        template: 'email-verification',
        data: {
          buttonUrl: data.verificationUrl,
          buttonText: 'Verify Email',
        },
      },
      tags: ['auth', 'verification'],
      category: 'system' as const,
    },
  ],
});
