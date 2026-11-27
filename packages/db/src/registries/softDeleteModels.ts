/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { AUDIT_ENABLED_MODELS } from '@template/db/registries/auditEnabledModels';
import { isHardDeletedOnTombstone } from '@template/db/registries/hardDeleteOnTombstone';

const SOFT_DELETE_ONLY = [
  'Contact',
  'File',
  'FileVersion',
  'IntegrationRecord',
  'ResourceBinding',
  'SegmentMember',
  'Tag',
  'TagAttachment',
  'TagCategory',
] as const;

export const SOFT_DELETE_MODELS: readonly string[] = [
  ...AUDIT_ENABLED_MODELS.filter((model) => !isHardDeletedOnTombstone(model)),
  ...SOFT_DELETE_ONLY,
];

export const SOFT_DELETE_MODEL_SET = new Set<string>(SOFT_DELETE_MODELS);

export const isSoftDeleteModel = (model: string): boolean => SOFT_DELETE_MODEL_SET.has(model);
