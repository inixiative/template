/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const flowFactory = createFactory('Flow', {
  defaults: () => ({
    flowKey: 'setUpOrganization' as const,
    returnUrl: '/dashboard',
  }),
});

export const buildFlow = flowFactory.build;
export const createFlow = flowFactory.create;
