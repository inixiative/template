/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const flowFactory = createFactory('Flow', {
  defaults: () => ({
    flowKey: 'setUpOrganization' as const,
    steps: [],
  }),
});

export const buildFlow = flowFactory.build;
export const createFlow = flowFactory.create;
