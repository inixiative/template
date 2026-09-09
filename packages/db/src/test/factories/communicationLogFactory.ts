/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { createFactory, getNextSeq } from '@template/db/test/factory';

const communicationLogFactory = createFactory('CommunicationLog', {
  defaults: () => ({
    sendKey: `send-${getNextSeq()}`,
    channel: 'email' as const,
    address: `recipient-${getNextSeq()}@example.com`,
    idempotencyKey: crypto.randomUUID(),
    senderType: 'platform' as const,
  }),
});

export const buildCommunicationLog = communicationLogFactory.build;
export const createCommunicationLog = communicationLogFactory.create;
