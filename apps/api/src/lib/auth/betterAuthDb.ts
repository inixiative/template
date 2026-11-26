/**
 * @atlas
 * @kind client
 * @partOf feature:auth
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';

type ModelDelegate = Record<string | symbol, unknown> & {
  updateManyAndReturn: (args: unknown) => Promise<unknown[]>;
};

const isModelDelegate = (member: unknown): member is ModelDelegate =>
  typeof member === 'object' && member !== null && 'updateManyAndReturn' in member;

const routeUpdateManyThroughHooks = (delegate: ModelDelegate) =>
  new Proxy(delegate, {
    get(target, op) {
      if (op === 'updateMany')
        return async (args: unknown) => ({
          count: (await target.updateManyAndReturn(args)).length,
        });
      const member = Reflect.get(target, op);
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });

export const betterAuthDb: typeof db = new Proxy(db, {
  get(target, prop) {
    const member = Reflect.get(target, prop);
    return isModelDelegate(member) ? routeUpdateManyThroughHooks(member) : member;
  },
});
