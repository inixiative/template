import { makeAppEvent } from '#/appEvents/makeAppEvent';

type UserCreatedData = {
  userId: string;
  isGuest: boolean;
};

makeAppEvent<UserCreatedData>('user.created', {
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
