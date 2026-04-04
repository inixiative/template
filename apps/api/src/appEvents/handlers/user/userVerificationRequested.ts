import { makeAppEvent } from '#/appEvents/makeAppEvent';

type UserVerificationRequestedData = {
  userId: string;
  verificationUrl: string;
};

makeAppEvent<UserVerificationRequestedData>('user.verificationRequested', {
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
