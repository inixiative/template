import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type UserCreatedPayload = {
  userId: string;
  isGuest: boolean;
};

makeAppEvent<UserCreatedPayload>('user.created', {
  email: (data) => [
    {
      target: { userIds: [data.userId] },
      message: {
        template: 'welcome',
        data: { isGuest: data.isGuest },
      },
      tags: ['user', 'welcome'],
      category: 'system' as const,
    },
  ],
});
