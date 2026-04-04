import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserVerificationRequestedPayload = {
  userId: string;
  verificationUrl: string;
};

makeAppEvent<UserVerificationRequestedPayload>('user.verificationRequested', {
  email: (data) => [
    {
      to: [{ userIds: [data.userId] }],
      template: 'email-verification',
      data: {
        buttonUrl: data.verificationUrl,
        buttonText: 'Verify Email',
      },
    },
  ],
});
