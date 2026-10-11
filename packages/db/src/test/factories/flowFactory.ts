/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const flowFactory = createFactory('Flow', {
  defaults: () => ({
    returnUrl: '/dashboard',
  }),
});

export const buildFlow = flowFactory.build;
export const createFlow = flowFactory.create;
