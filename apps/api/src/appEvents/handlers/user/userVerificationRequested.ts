/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses none
 */
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserVerificationRequestedPayload = {
  userId: string;
  verificationUrl: string;
};

export const userVerificationRequested = makeAppEvent<UserVerificationRequestedPayload>({
  email: (data) => [
    {
      template: 'email-verification',
      data: { userId: data.userId, verificationUrl: data.verificationUrl },
    },
  ],
});
