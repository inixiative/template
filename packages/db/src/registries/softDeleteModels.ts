/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { AUDIT_ENABLED_MODELS } from '@template/db/registries/auditEnabledModels';

const SOFT_DELETE_ONLY = ['Contact', 'Tag', 'TagAttachment', 'TagCategory'] as const;

export const SOFT_DELETE_MODELS: readonly string[] = [...AUDIT_ENABLED_MODELS, ...SOFT_DELETE_ONLY];

export const SOFT_DELETE_MODEL_SET = new Set<string>(SOFT_DELETE_MODELS);

export const isSoftDeleteModel = (model: string): boolean => SOFT_DELETE_MODEL_SET.has(model);
