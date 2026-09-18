/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import {
  applyLens,
  type Condition,
  checkRuleAgainstLens,
  createLens,
  exposedSurface,
  type FieldMap,
  type FieldMapEntry,
  type Lens,
  type LensNarrowing,
  lensRequiredBindings,
  type ModelNarrowing,
  resolveLensBindings,
  type RuleLensViolation,
  type RuleValue,
  type SourceQuery,
  sourceQueries,
  validateNarrowing,
} from '@inixiative/json-rules';
import { RULE_REFERENCEABLE_MODELS, ruleReferences } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { lensFor, omitForeignKeys } from '@template/db/lens';
import type { ModelName } from '@template/db/utils/modelNames';
import { RESERVED_SCOPE_ROOTS, SCOPE_ROOTS, type ScopeRoot } from '@template/email/render/conditionParser';
import { SYSTEM_TOKENS } from '@template/email/render/systemTokens';
import { RAIL_PROVIDED_SYSTEM_FIELDS } from '@template/email/rules/railProvidedSystemFields';
import { walkConditionTree } from '@template/email/rules/walkConditionTree';
import { type LensPathWalk, walkLensPath } from '@template/email/rules/walkLensPath';
import type { RuleLens, RuleReference, RuleVocabulary } from '@template/shared/rules';
import { startCase } from 'lodash-es';

export const OPAQUE_SLOT = 'opaque';
export const EMAIL_MAP_NAME = 'email';
export const EMAIL_SURFACE_ROOT = 'Email';
export const EMAIL_DATA_MODEL = 'EmailData';
export const EMAIL_SYSTEM_MODEL = 'EmailSystem';

export type SlotLens = RuleLens | typeof OPAQUE_SLOT;
export type EmailLens = { [Root in ScopeRoot]?: SlotLens };

export type EmailContextRelation = { name: string; model: ModelName; isList?: boolean };

export type EmailDataProjection =
  | { kind: 'model'; model: ModelName }
  | { kind: 'fields'; fields: Record<string, string> }
  | { kind: 'relations'; relations: EmailContextRelation[] };

export type EmailDataLens = { model?: ModelName; narrowing?: ModelNarrowing };

export type EmailSlotLenses = {
  recipient?: ModelNarrowing;
  sender?: ModelNarrowing;
  data?: EmailDataLens;
};

export type EmailLensInput = {
  recipientModel?: ModelName;
  senderModel?: ModelName | null;
  data?: EmailDataProjection;
  slots?: EmailSlotLenses;
};

const referenced: ModelNarrowing = { picks: ['id', 'name'] };

export const DEFAULT_RECIPIENT_NARROWING: ModelNarrowing = {
  picks: ['id', 'name', 'email'],
  relations: {
    tagAttachments: { picks: [], relations: { tag: referenced } },
    spaceUsers: { picks: ['role'], relations: { space: referenced } },
    organizationUsers: { picks: ['role'], relations: { organization: referenced } },
    providerRefs: { picks: [], relations: { segmentMembers: { picks: [], relations: { segment: referenced } } } },
  },
};

const referenceableSources = Object.fromEntries(
  RULE_REFERENCEABLE_MODELS.map((model) => [model, { sources: { id: { label: 'name' } } }]),
);

const prismaModels = prismaMap.models as Record<string, { fields: Record<string, { kind: string; type: string }> }>;

const scalarPicks = (model: string, fields = prismaModels[model]?.fields ?? {}): ModelNarrowing => ({
  picks: Object.entries(fields)
    .filter(([, field]) => field.kind !== 'object' && field.kind !== 'bridge')
    .map(([name]) => name),
});

const narrowed = (parent: Lens, root: ModelNarrowing): LensNarrowing => {
  const declared: LensNarrowing = { parent, mapDefaults: { prisma: { models: referenceableSources } }, root };
  validateNarrowing(declared);
  return omitForeignKeys(declared);
};

const prismaSlot = (model: ModelName, root: ModelNarrowing = scalarPicks(model)): LensNarrowing =>
  narrowed(lensFor(model), root);

const declaredSlot = (model: string, fields: Record<string, string>, root?: ModelNarrowing): RuleLens => {
  const lens = createLens({
    maps: {
      [EMAIL_MAP_NAME]: {
        models: {
          [model]: {
            fields: Object.fromEntries(Object.entries(fields).map(([name, type]) => [name, { kind: 'scalar', type }])),
          },
        },
      },
    },
    mapName: EMAIL_MAP_NAME,
    model,
  });
  if (!root) return lens;
  const declared: LensNarrowing = { parent: lens, root };
  validateNarrowing(declared);
  return declared;
};

const relation = (model: string, relationName: string, isList: boolean): FieldMapEntry => ({
  kind: 'object',
  type: model,
  isList,
  relationName,
  fromFields: [],
  toFields: [],
});

const relationsSlot = (relations: EmailContextRelation[], root?: ModelNarrowing): LensNarrowing => {
  const prisma = prismaMap as unknown as FieldMap;
  const lens = createLens({
    maps: {
      prisma: {
        ...prisma,
        models: {
          ...prisma.models,
          [EMAIL_DATA_MODEL]: {
            fields: Object.fromEntries(
              relations.map((rel) => [rel.name, relation(rel.model, `EmailData_${rel.name}`, rel.isList ?? false)]),
            ),
          },
        },
      },
    },
    mapName: 'prisma',
    model: EMAIL_DATA_MODEL,
  });
  return narrowed(
    lens,
    root ?? { relations: Object.fromEntries(relations.map((rel) => [rel.name, scalarPicks(rel.model)])) },
  );
};

const dataSlot = (data: EmailDataProjection | undefined, slot: EmailDataLens | undefined): SlotLens => {
  if (!data) return OPAQUE_SLOT;
  switch (data.kind) {
    case 'model':
      return prismaSlot(data.model, slot?.narrowing);
    case 'fields':
      return declaredSlot(EMAIL_DATA_MODEL, data.fields, slot?.narrowing);
    case 'relations':
      return relationsSlot(data.relations, slot?.narrowing);
  }
};

const SYSTEM_FIELDS: Record<string, string> = {
  ...Object.fromEntries(SYSTEM_TOKENS.map(({ name, kind }) => [name, kind])),
  ...Object.fromEntries(RAIL_PROVIDED_SYSTEM_FIELDS.map((name) => [name, 'String'])),
};

export const systemSlot = (): Lens => declaredSlot(EMAIL_SYSTEM_MODEL, SYSTEM_FIELDS) as Lens;

export const emailLens = ({ recipientModel = 'User', senderModel, data, slots = {} }: EmailLensInput = {}): EmailLens => ({
  ...(senderModel ? { sender: prismaSlot(senderModel, slots.sender) } : {}),
  recipient: prismaSlot(
    recipientModel,
    slots.recipient ?? (recipientModel === 'User' ? DEFAULT_RECIPIENT_NARROWING : undefined),
  ),
  data: dataSlot(data, slots.data),
  system: systemSlot(),
});

export const defaultEmailLens: EmailLens = emailLens();

export const splitRoot = (path: string): { root: string; rest: string } => {
  const dot = path.indexOf('.');
  return dot === -1 ? { root: path, rest: '' } : { root: path.slice(0, dot), rest: path.slice(dot + 1) };
};

const isScopeRoot = (root: string): root is ScopeRoot => RESERVED_SCOPE_ROOTS.has(root);

export const slotOf = (lens: EmailLens, root: string): SlotLens | undefined =>
  isScopeRoot(root) ? lens[root] : undefined;

export const walkEmailLensPath = (path: string, lens: EmailLens): LensPathWalk => {
  const { root, rest } = splitRoot(path);
  const slot = slotOf(lens, root);
  if (!slot) return { outcome: 'missing', index: 0 };
  if (slot === OPAQUE_SLOT) return rest ? { outcome: 'beneathJson', index: 0 } : { outcome: 'resolved' };
  if (!rest) return { outcome: 'resolved' };
  const walk = walkLensPath(rest, slot);
  return walk.outcome === 'resolved' ? walk : { ...walk, index: walk.index + 1 };
};

type Leaf = Record<string, unknown> & { field: string };

type Slice = { root: ScopeRoot; rest: string; slot: SlotLens; leaf: Leaf };

const isLeaf = (condition: unknown): condition is Leaf =>
  typeof condition === 'object' && condition !== null && typeof (condition as Leaf).field === 'string';

const sliceOf = (lens: EmailLens, leaf: Leaf): Slice | undefined => {
  const { root, rest } = splitRoot(leaf.field);
  if (!isScopeRoot(root)) return undefined;
  const slot = lens[root];
  return slot ? { root, rest, slot, leaf } : undefined;
};

const absolutePathsIn = (leaf: Leaf): Set<string> => {
  const out = new Set<string>();
  walkConditionTree(leaf as Condition, undefined, (node) => {
    const record = node as Record<string, unknown>;
    if (typeof record.path === 'string' && record.path && !record.path.startsWith('$.')) out.add(record.path);
    return [
      { condition: record.condition as Condition | undefined, context: undefined },
      { condition: record.filter as Condition | undefined, context: undefined },
    ];
  });
  return out;
};

const leaves = (rule: Condition): Leaf[] => {
  const out: Leaf[] = [];
  walkConditionTree(rule, undefined, (node) => {
    if (isLeaf(node)) out.push(node);
    return undefined;
  });
  return out;
};

export const emailRuleViolations = (lens: EmailLens, rule: Condition): RuleLensViolation[] => {
  const violations: RuleLensViolation[] = [];
  for (const leaf of leaves(rule)) {
    const { root, rest } = splitRoot(leaf.field);
    const slot = slotOf(lens, root);
    if (!slot) {
      violations.push({ path: leaf.field, reason: `"${root}" is not a lens this template renders with` });
      continue;
    }
    if (slot === OPAQUE_SLOT) continue;
    if (!rest) {
      violations.push({ path: leaf.field, reason: 'names a lens, not a field' });
      continue;
    }
    const crossings = absolutePathsIn(leaf);
    for (const crossing of crossings) {
      const walk = walkEmailLensPath(crossing, lens);
      if (walk.outcome === 'missing' || walk.outcome === 'pastScalar') {
        violations.push({ path: crossing, reason: 'path (comparison ref) does not resolve through the narrowed lens' });
      }
    }
    for (const violation of checkRuleAgainstLens({ ...leaf, field: rest } as Condition, slot).violations) {
      if (crossings.has(violation.path)) continue;
      violations.push({ path: `${root}.${violation.path}`, reason: violation.reason });
    }
  }
  return violations;
};

export const emailRuleVocabularyIssues = (lens: EmailLens, rule: Condition): string[] =>
  emailRuleViolations(lens, rule).map((violation) => `${violation.path}: ${violation.reason}`);

export const emailRuleVocabulary = (lens: EmailLens): RuleVocabulary => ({
  vocabularyIssues: (rule) => emailRuleVocabularyIssues(lens, rule),
});

export const emailRuleReferences = (lens: EmailLens, rule: Condition): RuleReference[] =>
  leaves(rule).flatMap((leaf) => {
    const slice = sliceOf(lens, leaf);
    if (!slice || slice.slot === OPAQUE_SLOT || !slice.rest) return [];
    return ruleReferences(slice.slot, { ...leaf, field: slice.rest } as Condition);
  });

const prefixed = (condition: Condition, root: string): Condition => {
  if (condition == null || typeof condition === 'boolean') return condition;
  const node = condition as Record<string, unknown>;
  if (Array.isArray(node.all)) return { ...node, all: node.all.map((child) => prefixed(child, root)) } as Condition;
  if (Array.isArray(node.any)) return { ...node, any: node.any.map((child) => prefixed(child, root)) } as Condition;
  if ('if' in node) {
    return {
      ...node,
      if: prefixed(node.if as Condition, root),
      then: prefixed(node.then as Condition, root),
      ...(node.else !== undefined ? { else: prefixed(node.else as Condition, root) } : {}),
    } as Condition;
  }
  return typeof node.field === 'string' ? ({ ...node, field: `${root}.${node.field}` } as Condition) : condition;
};

export const applyEmailLens = (lens: EmailLens, rule: Condition): Condition => {
  if (rule == null || typeof rule === 'boolean') return rule;
  const node = rule as Record<string, unknown>;
  if (Array.isArray(node.all)) return { ...node, all: node.all.map((child) => applyEmailLens(lens, child)) } as Condition;
  if (Array.isArray(node.any)) return { ...node, any: node.any.map((child) => applyEmailLens(lens, child)) } as Condition;
  if ('if' in node) {
    return {
      ...node,
      if: applyEmailLens(lens, node.if as Condition),
      then: applyEmailLens(lens, node.then as Condition),
      ...(node.else !== undefined ? { else: applyEmailLens(lens, node.else as Condition) } : {}),
    } as Condition;
  }
  if (!isLeaf(rule)) return rule;
  const slice = sliceOf(lens, rule);
  if (!slice || slice.slot === OPAQUE_SLOT || !slice.rest) return rule;
  return prefixed(applyLens({ ...rule, field: slice.rest } as Condition, slice.slot), slice.root);
};

export const emailSlotLenses = (lens: EmailLens): [ScopeRoot, RuleLens][] =>
  SCOPE_ROOTS.flatMap((root) => {
    const slot = lens[root];
    return slot && slot !== OPAQUE_SLOT ? [[root, slot] as [ScopeRoot, RuleLens]] : [];
  });

export const emailSourceQueries = (lens: EmailLens): SourceQuery[] =>
  emailSlotLenses(lens).flatMap(([, slot]) => sourceQueries(slot));

export const emailLensRequiredBindings = (lens: EmailLens): Set<string> =>
  new Set(emailSlotLenses(lens).flatMap(([, slot]) => [...lensRequiredBindings(slot)]));

export const resolveEmailLensBindings = (lens: EmailLens, values: Record<string, RuleValue>): EmailLens => ({
  ...lens,
  ...Object.fromEntries(emailSlotLenses(lens).map(([root, slot]) => [root, resolveLensBindings(slot, values) as RuleLens])),
});

export const narrowEmailLens = (
  lens: EmailLens,
  narrow: (root: ScopeRoot, slot: RuleLens) => RuleLens,
): EmailLens => ({
  ...lens,
  ...Object.fromEntries(emailSlotLenses(lens).map(([root, slot]) => [root, narrow(root, slot)])),
});

export const emailSurface = (lens: EmailLens): Lens => {
  const models: FieldMap['models'] = {};
  const enums: NonNullable<FieldMap['enums']> = {};
  const rootFields: Record<string, FieldMapEntry> = {};
  for (const root of SCOPE_ROOTS) {
    const slot = lens[root];
    if (!slot) continue;
    if (slot === OPAQUE_SLOT) {
      rootFields[root] = { kind: 'scalar', type: 'Json' };
      continue;
    }
    const surface = exposedSurface(slot);
    for (const map of Object.values(surface.maps)) {
      for (const [model, entry] of Object.entries(map.models)) {
        const fields = { ...(models[model]?.fields ?? {}), ...entry.fields };
        models[model] = { ...models[model], ...entry, fields };
      }
      Object.assign(enums, map.enums ?? {});
    }
    rootFields[root] = relation(surface.model, `Email_${root}`, false);
  }
  return createLens({
    maps: { [EMAIL_MAP_NAME]: { models: { ...models, [EMAIL_SURFACE_ROOT]: { fields: rootFields } }, enums } },
    mapName: EMAIL_MAP_NAME,
    model: EMAIL_SURFACE_ROOT,
  });
};

export type EmailRuleFacet = { path: string; label: string };
export type EmailRuleDecoration = { facets: EmailRuleFacet[] };

export const emailRuleDecoration = (lens: EmailLens): EmailRuleDecoration => ({
  facets: SCOPE_ROOTS.filter((root) => lens[root]).map((root) => ({ path: root, label: startCase(root) })),
});

const isNarrowing = (value: unknown): value is ModelNarrowing =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseDataLens = (value: unknown): EmailDataLens | undefined => {
  if (!isNarrowing(value)) return undefined;
  const doc = value as Record<string, unknown>;
  return {
    ...(typeof doc.model === 'string' ? { model: doc.model as ModelName } : {}),
    ...(isNarrowing(doc.narrowing) ? { narrowing: doc.narrowing } : {}),
  };
};

export const parseSlotLenses = (raw: unknown): EmailSlotLenses => {
  if (!isNarrowing(raw)) return {};
  const doc = raw as Record<string, unknown>;
  const data = parseDataLens(doc.data);
  return {
    ...(isNarrowing(doc.recipient) ? { recipient: doc.recipient } : {}),
    ...(isNarrowing(doc.sender) ? { sender: doc.sender } : {}),
    ...(data ? { data } : {}),
  };
};
