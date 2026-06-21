import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { castArray } from 'lodash-es';

type CreatedUser = { id: string; email: string | null };

export const registerUserEmailContactHook = () => {
  registerDbHook(
    'userEmailContact:create',
    'User',
    HookTiming.after,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ result }) => {
      for (const user of castArray(result) as CreatedUser[]) {
        if (!user?.email) continue;
        const existing = await db.contact.findFirst({
          where: { userId: user.id, type: ContactType.email },
          select: { id: true },
        });
        if (existing) continue;
        await db.contact.create({
          data: {
            ownerModel: ContactOwnerModel.User,
            userId: user.id,
            type: ContactType.email,
            value: { address: user.email },
            source: 'user-creation',
          },
        });
      }
    },
  );
};
