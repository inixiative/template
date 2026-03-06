import { AuditSubjectModel } from '@template/db/generated/client/enums';

export const AUDIT_ENABLED_MODELS = Object.values(AuditSubjectModel);

export const isAuditEnabled = (model: string): model is AuditSubjectModel =>
  AUDIT_ENABLED_MODELS.includes(model as AuditSubjectModel);
