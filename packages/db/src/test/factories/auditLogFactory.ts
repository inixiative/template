import { AuditAction, AuditSubjectModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const auditLogFactory = createFactory('AuditLog', {
  defaults: () => ({
    action: AuditAction.create,
    subjectModel: AuditSubjectModel.User,
  }),
  dependencies: {
    actorUser: {
      modelName: 'User',
      foreignKey: { id: 'actorUserId' },
      required: false,
    },
  },
});

export const buildAuditLog = auditLogFactory.build;
export const createAuditLog = auditLogFactory.create;
