import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { toArray } from '@template/shared/utils';

type CreatedUser = { id: string; email: string };

export const registerUserEmailContactHook = () => {
  registerDbHook(
    'userEmailContact:create',
    'User',
    HookTiming.after,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ result }) => {
      for (const user of toArray(result) as CreatedUser[]) {
        await db.contact.upsert({
          where: {
            userId_type_valueKey: { userId: user.id, type: ContactType.email, valueKey: user.email.toLowerCase() },
          },
          create: {
            ownerModel: ContactOwnerModel.User,
            userId: user.id,
            type: ContactType.email,
            value: { address: user.email },
            source: 'user-creation',
          },
          update: {},
        });
      }
    },
  );
};
