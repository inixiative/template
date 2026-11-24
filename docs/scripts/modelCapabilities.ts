#!/usr/bin/env bun
/**
 * Regenerate the Model Capabilities Matrix in `docs/claude/MODEL_CAPABILITIES.md`
 * from the live Prisma field-map and capability registries.
 *
 * Usage:
 *   bun docs/scripts/modelCapabilities.ts          # write in place
 *   bun docs/scripts/modelCapabilities.ts --check  # exit 1 if out of date
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cacheKeysByModel } from '../../apps/api/src/hooks/cache/constants/cacheKeysByModel';
import { ImmutableFieldsOverrides } from '../../apps/api/src/hooks/immutableFields/registry';
import { isRuleReferenceSourceModel } from '../../apps/api/src/hooks/ruleReference/surfaces';
import { RulesRegistry } from '../../apps/api/src/hooks/rules/registry';
import { CASCADE_EXEMPT } from '../../apps/api/src/hooks/softDeleteCascade/cascadeExempt';
import { CLOSE_ON_PARENT_DELETE } from '../../apps/api/src/hooks/softDeleteCascade/closeOnParentDelete';
import { REGENERATE_ON_REVIVE } from '../../apps/api/src/hooks/softDeleteCascade/regenerateOnRevive';
import { prismaMap } from '../../packages/db/src/generated/prismaMap.gen';
import { attributeFieldsByModel } from '../../packages/db/src/lib/attributes/registry';
import { encryptedFieldsByModel } from '../../packages/db/src/lib/encryption/registry';
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
} from '../../packages/db/src/registries';
import { type ModelName, resourceOfModel } from '../../packages/db/src/utils/modelNames';
import { schemaMap } from '../../packages/permissions/src/rebac/schema';

export const CAPABILITIES_START = '<!-- capabilities:start -->';
export const CAPABILITIES_END = '<!-- capabilities:end -->';

export type ModelCapabilitiesRow = {
  model: ModelName;
  deleteLifecycle: string;
  audit: boolean;
  polymorphicAxes: string[];
  parentEdge: string;
  attribute: boolean;
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
  const attributes = attributeFieldsByModel();
  const encrypted = encryptedFieldsByModel();
  const webhookSet = new Set<string>(webhookEnabledModels);
  const rebacResources = schemaMap.permissions as Record<string, unknown>;
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
      attribute: (attributes[model]?.length ?? 0) > 0,
      encrypted: (encrypted[model]?.length ?? 0) > 0,
      orderedList: Object.hasOwn(orderedListRegistry, model),
      fieldPolicies,
      writeRules: Object.hasOwn(RulesRegistry, model),
      ruleRefSource: isRuleReferenceSourceModel(model),
      cached: Object.hasOwn(cacheKeysByModel, model),
      webhook: webhookSet.has(model),
      rebac: Object.hasOwn(rebacResources, resourceOfModel(model)),
    };
  });
};

const yesNo = (value: boolean): string => (value ? 'yes' : '-');

export const renderModelCapabilitiesTable = (rows: readonly ModelCapabilitiesRow[]): string => {
  const header = [
    '| Model | Delete lifecycle | Audit | Polymorphic axes | Parent edge | Attribute | Encrypted | Ordered list | Field policies | Write rules | Rule ref source | Cached | Webhook | ReBAC |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];

  const lines = rows.map((row) =>
    [
      row.model,
      row.deleteLifecycle,
      yesNo(row.audit),
      row.polymorphicAxes.length ? row.polymorphicAxes.join(', ') : '-',
      row.parentEdge,
      yesNo(row.attribute),
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

if (import.meta.main) {
  const checkOnly = process.argv.includes('--check');
  const repoRoot = resolve(import.meta.dir, '../..');
  const targetPath = resolve(repoRoot, 'docs/claude/MODEL_CAPABILITIES.md');
  const current = readFileSync(targetPath, 'utf8');
  const table = renderModelCapabilitiesTable(buildModelCapabilitiesRows());
  const next = replaceCapabilitiesBlock(current, table);

  if (checkOnly) {
    if (current !== next) {
      console.error(
        'docs/claude/MODEL_CAPABILITIES.md is out of date. Run: bun docs/scripts/modelCapabilities.ts',
      );
      process.exit(1);
    }
    console.log('docs/claude/MODEL_CAPABILITIES.md is up to date.');
  } else if (current !== next) {
    writeFileSync(targetPath, next, 'utf8');
    console.log('Updated docs/claude/MODEL_CAPABILITIES.md');
  } else {
    console.log('docs/claude/MODEL_CAPABILITIES.md unchanged.');
  }
}
