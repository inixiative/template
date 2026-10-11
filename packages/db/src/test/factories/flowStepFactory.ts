/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory, getNextSeq } from '@template/db/test/factory';

const flowStepFactory = createFactory('FlowStep', {
  defaults: () => {
    const seq = getNextSeq();
    return {
      order: seq,
      label: faker.lorem.words(3),
      url: `/flow-step-${seq}`,
    };
  },
});

export const buildFlowStep = flowStepFactory.build;
export const createFlowStep = flowStepFactory.create;
