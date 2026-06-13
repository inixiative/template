/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { AuditSubjectModel } from '@template/db/generated/client/enums';

export const AUDIT_ENABLED_MODELS: AuditSubjectModel[] = [
  AuditSubjectModel.User,
  AuditSubjectModel.Organization,
  AuditSubjectModel.OrganizationUser,
  AuditSubjectModel.Space,
  AuditSubjectModel.SpaceUser,
  AuditSubjectModel.AuthProvider,
  AuditSubjectModel.Inquiry,
  AuditSubjectModel.CustomerRef,
  AuditSubjectModel.EmailTemplate,
  AuditSubjectModel.EmailComponent,
  // Token, Account, Session excluded — ephemeral auth state, hard-deleted on redact.
];

export const isAuditEnabled = (model: string): model is AuditSubjectModel =>
  AUDIT_ENABLED_MODELS.includes(model as AuditSubjectModel);
