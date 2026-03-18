import { AuditSubjectModel } from '@template/db/generated/client/enums';

export const AUDIT_ENABLED_MODELS: AuditSubjectModel[] = [
  AuditSubjectModel.User,
  AuditSubjectModel.Account,
  AuditSubjectModel.Organization,
  AuditSubjectModel.OrganizationUser,
  AuditSubjectModel.Space,
  AuditSubjectModel.SpaceUser,
  AuditSubjectModel.Token,
  AuditSubjectModel.AuthProvider,
  AuditSubjectModel.Inquiry,
  AuditSubjectModel.CustomerRef,
  AuditSubjectModel.EmailTemplate,
  AuditSubjectModel.EmailComponent,
];

export const isAuditEnabled = (model: string): model is AuditSubjectModel =>
  AUDIT_ENABLED_MODELS.includes(model as AuditSubjectModel);
