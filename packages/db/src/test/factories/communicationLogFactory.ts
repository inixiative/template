/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { CommunicationChannel } from '@template/db/generated/client/enums';
import { nextFactorySequenceNumber, registerFactory } from '@template/db/test/factory';

const communicationLogFactory = registerFactory('CommunicationLog', {
  defaults: () => ({
    sendKey: `send-${nextFactorySequenceNumber()}`,
    channel: CommunicationChannel.email,
    address: faker.internet.email().toLowerCase(),
    idempotencyKey: `idem-${nextFactorySequenceNumber()}-${faker.string.alphanumeric(8)}`,
  }),
  dependencies: {
    recipientUser: {
      modelName: 'User',
      foreignKey: { id: 'recipientUserId' },
      required: false,
    },
    senderSpace: {
      modelName: 'Space',
      foreignKey: { id: 'senderSpaceId' },
      required: false,
    },
  },
});

export const buildCommunicationLog = communicationLogFactory.build;
export const createCommunicationLog = communicationLogFactory.create;
