/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const communicationComponentVersionFactory = registerFactory('CommunicationComponentVersion', {
  defaults: () => ({
    slug: `component-${nextFactorySequenceNumber()}`,
  }),
});

export const buildCommunicationComponentVersion = communicationComponentVersionFactory.build;
export const createCommunicationComponentVersion = communicationComponentVersionFactory.create;
