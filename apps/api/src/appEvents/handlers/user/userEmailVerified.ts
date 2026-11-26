/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses none
 */
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserEmailVerifiedPayload = {
  userId: string;
};

export const userEmailVerified = makeAppEvent<UserEmailVerifiedPayload>({
  email: (data) => [{ template: 'welcome', data: { userId: data.userId } }],
});
