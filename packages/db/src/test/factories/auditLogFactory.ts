/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { AuditAction } from '@template/db/generated/client/enums';
import { registerFactory } from '@template/db/test/factory';

const auditLogFactory = registerFactory('AuditLog', {
  defaults: () => ({
    action: AuditAction.create,
  }),
  dependencies: {
    actorUser: {
      modelName: 'User',
      foreignKey: { id: 'actorUserId' },
      required: false,
    },
    actorSpoofUser: {
      modelName: 'User',
      foreignKey: { id: 'actorSpoofUserId' },
      required: false,
    },
    actorToken: {
      modelName: 'Token',
      foreignKey: { id: 'actorTokenId' },
      required: false,
    },
    contextOrganization: {
      modelName: 'Organization',
      foreignKey: { id: 'contextOrganizationId' },
      required: false,
    },
    contextSpace: {
      modelName: 'Space',
      foreignKey: { id: 'contextSpaceId' },
      required: false,
    },
  },
});

export const buildAuditLog = auditLogFactory.build;
export const createAuditLog = auditLogFactory.create;
