/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { CommunicationChannel, SenderType } from '@template/db/generated/client/enums';
import { createFactory, getNextSeq } from '@template/db/test/factory';

const communicationLogFactory = createFactory('CommunicationLog', {
  defaults: () => ({
    sendKey: `send-${getNextSeq()}`,
    channel: CommunicationChannel.email,
    senderType: SenderType.platform,
    address: faker.internet.email().toLowerCase(),
    idempotencyKey: `idem-${getNextSeq()}-${faker.string.alphanumeric(8)}`,
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
