/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses none
 */
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserPasswordResetRequestedPayload = {
  userId: string;
  passwordResetUrl: string;
};

export const userPasswordResetRequested = makeAppEvent<UserPasswordResetRequestedPayload>({
  email: (data) => [
    {
      template: 'password-reset',
      data: { userId: data.userId, passwordResetUrl: data.passwordResetUrl },
    },
  ],
});
