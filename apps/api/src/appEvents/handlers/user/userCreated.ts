import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserCreatedPayload = {
  userId: string;
  isGuest: boolean;
};

export const userCreated = makeAppEvent<UserCreatedPayload>({
  email: (data) => [
    {
      to: [{ userIds: [data.userId] }],
      template: 'welcome',
      data: { isGuest: data.isGuest },
    },
  ],
  observe: (data) => ({ userId: data.userId, isGuest: data.isGuest }),
});
