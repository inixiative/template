import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserVerificationRequestedPayload = {
  userId: string;
  verificationUrl: string;
};

export const userVerificationRequested = makeAppEvent<UserVerificationRequestedPayload>({
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
  observe: (data) => ({ userId: data.userId }),
});
