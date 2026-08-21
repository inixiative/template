/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses none
 */
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserCreatedPayload = {
  userId: string;
  isGuest: boolean;
};

export const userCreated = makeAppEvent<UserCreatedPayload>({
  email: (data) => [
    {
      template: 'welcome',
      data: { userId: data.userId, isGuest: data.isGuest },
    },
  ],
});
