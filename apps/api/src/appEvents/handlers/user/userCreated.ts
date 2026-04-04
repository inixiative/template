import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserCreatedPayload = {
  userId: string;
  isGuest: boolean;
};

makeAppEvent<UserCreatedPayload>('user.created', {
  email: (data) => [
    {
      to: [{ userIds: [data.userId] }],
      template: 'welcome',
      data: { isGuest: data.isGuest },
    },
  ],
});
