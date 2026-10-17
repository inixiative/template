/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { createFactory, getNextSeq } from '@template/db/test/factory';

const communicationComponentVersionFactory = createFactory('CommunicationComponentVersion', {
  defaults: () => ({
    slug: `component-${getNextSeq()}`,
  }),
});

export const buildCommunicationComponentVersion = communicationComponentVersionFactory.build;
export const createCommunicationComponentVersion = communicationComponentVersionFactory.create;
