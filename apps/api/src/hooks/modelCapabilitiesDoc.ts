/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses infrastructure:prisma, primitive:authz
 */
import { prismaMap } from '@template/db/generated/prismaMap';
import { encryptedFieldsByModel } from '@template/db/lib/encryption/registry';
import {
  INTERNAL_FIELDS,
  isAuditEnabled,
  isHardDeletedOnTombstone,
  isSkippedOnRevive,
  isSoftDeleteModel,
  NOOP_FIELDS,
  orderedListRegistry,
  parentEdgeOf,
  polymorphismConfigForModel,
  SENSITIVE_FIELDS,
  webhookEnabledModels,
} from '@template/db/registries';
import { type ModelName, toAccessor } from '@template/db/utils/modelNames';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { cacheKeysByModel } from '#/hooks/cache/constants/cacheKeysByModel';
import { ImmutableFieldsOverrides } from '#/hooks/immutableFields/registry';
import { isRuleReferenceSourceModel } from '#/hooks/ruleReference/surfaces';
import { RulesRegistry } from '#/hooks/rules/registry';
import { CASCADE_EXEMPT } from '#/hooks/softDeleteCascade/cascadeExempt';
import { CLOSE_ON_PARENT_DELETE } from '#/hooks/softDeleteCascade/closeOnParentDelete';
import { REGENERATE_ON_REVIVE } from '#/hooks/softDeleteCascade/regenerateOnRevive';

export const CAPABILITIES_START = '<!-- capabilities:start -->';
export const CAPABILITIES_END = '<!-- capabilities:end -->';

export type ModelCapabilitiesRow = {
  model: ModelName;
  deleteLifecycle: string;
  audit: boolean;
  polymorphicAxes: string[];
  parentEdge: string;
  encrypted: boolean;
  orderedList: boolean;
  fieldPolicies: string[];
  writeRules: boolean;
  ruleRefSource: boolean;
  cached: boolean;
  webhook: boolean;
  rebac: boolean;
};

const formatDeleteLifecycle = (model: ModelName): string => {
  const tags: string[] = [];
  if (isSoftDeleteModel(model)) tags.push('soft');
  if (isHardDeletedOnTombstone(model)) tags.push('hard-on-tombstone');
  if (isSkippedOnRevive(model)) tags.push('skip-revive');
  if (Object.hasOwn(CLOSE_ON_PARENT_DELETE, model)) tags.push('close-on-parent-delete');
  if (Object.hasOwn(REGENERATE_ON_REVIVE, model)) tags.push('regen-on-revive');
  if (Object.hasOwn(CASCADE_EXEMPT, model)) tags.push('cascade-exempt');
  return tags.length ? tags.join(', ') : '-';
};

const formatParentEdge = (model: ModelName): string => {
  const edge = parentEdgeOf(model);
  if (!edge) return '-';
  return 'parent' in edge ? `${edge.parent} (${edge.foreignKey})` : `axis: ${edge.axis}`;
};

export const buildModelCapabilitiesRows = (): ModelCapabilitiesRow[] => {
  const encrypted = encryptedFieldsByModel();
  const webhookSet = new Set<string>(webhookEnabledModels);
  const rebacResources = rebacSchema.permissions as Record<string, unknown>;
  const models = (Object.keys(prismaMap.models) as ModelName[]).sort();

  return models.map((model) => {
    const polymorphicAxes = (polymorphismConfigForModel(model)?.axes ?? []).map(
      (axis) => axis.field,
    );
    const fieldPolicies: string[] = [];
    if ((SENSITIVE_FIELDS[model]?.length ?? 0) > 0) fieldPolicies.push('sensitive');
    if ((INTERNAL_FIELDS[model]?.length ?? 0) > 0) fieldPolicies.push('internal');
    if ((NOOP_FIELDS[model]?.length ?? 0) > 0) fieldPolicies.push('noop');
    if (ImmutableFieldsOverrides[model]) fieldPolicies.push('immutable-override');

    return {
      model,
      deleteLifecycle: formatDeleteLifecycle(model),
      audit: isAuditEnabled(model),
      polymorphicAxes,
      parentEdge: formatParentEdge(model),
      encrypted: (encrypted[model]?.length ?? 0) > 0,
      orderedList: Object.hasOwn(orderedListRegistry, model),
      fieldPolicies,
      writeRules: Object.hasOwn(RulesRegistry, model),
      ruleRefSource: isRuleReferenceSourceModel(model),
      cached: Object.hasOwn(cacheKeysByModel, model),
      webhook: webhookSet.has(model),
      rebac: Object.hasOwn(rebacResources, `db:${toAccessor(model)}`),
    };
  });
};

const yesNo = (value: boolean): string => (value ? 'yes' : '-');

export const renderModelCapabilitiesTable = (rows: readonly ModelCapabilitiesRow[]): string => {
  const header = [
    '| Model | Delete lifecycle | Audit | Polymorphic axes | Parent edge | Encrypted | Ordered list | Field policies | Write rules | Rule ref source | Cached | Webhook | ReBAC |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];

  const lines = rows.map((row) =>
    [
      row.model,
      row.deleteLifecycle,
      yesNo(row.audit),
      row.polymorphicAxes.length ? row.polymorphicAxes.join(', ') : '-',
      row.parentEdge,
      yesNo(row.encrypted),
      yesNo(row.orderedList),
      row.fieldPolicies.length ? row.fieldPolicies.join(', ') : '-',
      yesNo(row.writeRules),
      yesNo(row.ruleRefSource),
      yesNo(row.cached),
      yesNo(row.webhook),
      yesNo(row.rebac),
    ]
      .map((cell) => ` ${cell} `)
      .join('|')
      .replace(/^/, '|')
      .replace(/$/, '|'),
  );

  return [...header, ...lines].join('\n');
};

export const replaceCapabilitiesBlock = (markdown: string, table: string): string => {
  const startIdx = markdown.indexOf(CAPABILITIES_START);
  const endIdx = markdown.indexOf(CAPABILITIES_END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `Missing ${CAPABILITIES_START} / ${CAPABILITIES_END} markers in target markdown file`,
    );
  }
  const before = markdown.slice(0, startIdx + CAPABILITIES_START.length);
  const after = markdown.slice(endIdx);
  return `${before}\n\n${table}\n\n${after}`;
};
