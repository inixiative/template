/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import {
  applyLens,
  type Condition,
  check,
  checkRuleAgainstLens,
  createLens,
  exposedSurface,
  type FieldMap,
  type FieldMapEntry,
  type Lens,
  type LensNarrowing,
  type ModelNarrowing,
  type RuleLensViolation,
  type SourceQuery,
  sourceQueries,
  validateNarrowing,
} from '@inixiative/json-rules';
import { RULE_REFERENCEABLE_MODELS, ruleReferences } from '@template/db';
import { lensFor, live, omitForeignKeys, prune, rootLens } from '@template/db/lens';
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

export type EmailSlotLenses = {
  recipient?: ModelNarrowing;
  sender?: ModelNarrowing;
  data?: ModelNarrowing;
};

export type EmailLensInput = {
  sender?: RuleLens | null;
  recipient?: RuleLens;
  data?: RuleLens | null;
  narrowing?: EmailSlotLenses;
};

const referenced: ModelNarrowing = { picks: ['id', 'name'] };

export const DEFAULT_RECIPIENT_NARROWING: ModelNarrowing = {
  picks: ['id', 'name', 'email'],
  relations: {
    tagAttachments: { picks: [], where: live, relations: { tag: referenced } },
    spaceUsers: { picks: ['role'], relations: { space: referenced } },
    organizationUsers: { picks: ['role'], relations: { organization: referenced } },
    providerRefs: { picks: [], relations: { segmentMembers: { picks: [], relations: { segment: referenced } } } },
  },
};

const referenceableSources = Object.fromEntries(
  RULE_REFERENCEABLE_MODELS.map((model) => [model, { sources: { id: { label: 'name' } } }]),
);

const baseOf = (lens: RuleLens): Lens => ('parent' in lens ? rootLens(lens) : lens);

const scalarPicks = (fields: Record<string, { kind: string }>): ModelNarrowing => ({
  picks: Object.entries(fields)
    .filter(([, field]) => field.kind !== 'object' && field.kind !== 'bridge')
    .map(([name]) => name),
});

const slot = (lens: RuleLens, narrowing?: ModelNarrowing): RuleLens => {
  const base = baseOf(lens);
  const prisma = base.mapName === 'prisma';
  const root =
    narrowing ??
    ('parent' in lens ? undefined : scalarPicks(base.maps[base.mapName]?.models[base.model]?.fields ?? {}));
  const declared: LensNarrowing = {
    parent: lens,
    ...(prisma ? { mapDefaults: { prisma: { models: referenceableSources } } } : {}),
    ...(root ? { root } : {}),
  };
  if (root) validateNarrowing(declared);
  return prisma ? omitForeignKeys(declared) : declared;
};

export const fieldsLens = (fields: Record<string, string>, model = EMAIL_DATA_MODEL): Lens =>
  createLens({
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

export const declaredFields = (lens: RuleLens): string[] | null => {
  const base = baseOf(lens);
  return base.mapName === EMAIL_MAP_NAME
    ? Object.keys(base.maps[EMAIL_MAP_NAME]?.models[base.model]?.fields ?? {})
    : null;
};

const relation = (model: string, relationName: string, isList: boolean): FieldMapEntry => ({
  kind: 'object',
  type: model,
  isList,
  relationName,
  fromFields: [],
  toFields: [],
});

const SYSTEM_FIELDS: Record<string, string> = {
  ...Object.fromEntries(SYSTEM_TOKENS.map(({ name, kind }) => [name, kind])),
  ...Object.fromEntries(RAIL_PROVIDED_SYSTEM_FIELDS.map((name) => [name, 'String'])),
};

export const systemSlot = (): Lens => fieldsLens(SYSTEM_FIELDS, EMAIL_SYSTEM_MODEL);

const isUserLens = (lens: RuleLens): boolean => {
  const base = baseOf(lens);
  return base.mapName === 'prisma' && base.model === 'User';
};

export const emailLens = ({
  sender,
  recipient = lensFor('User'),
  data,
  narrowing = {},
}: EmailLensInput = {}): EmailLens => ({
  ...(sender ? { sender: slot(sender, narrowing.sender) } : {}),
  recipient: slot(recipient, narrowing.recipient ?? (isUserLens(recipient) ? DEFAULT_RECIPIENT_NARROWING : undefined)),
  data: data ? slot(data, narrowing.data) : OPAQUE_SLOT,
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
    if (typeof record.path === 'string' && isScopeRoot(splitRoot(record.path).root)) out.add(record.path);
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

/** The dotted field chain a nested array rule descends — what a violation inside its condition is relative to. */
const arrayChain = (rule: Condition): string[] => {
  const chain: string[] = [];
  let node = rule as Record<string, unknown>;
  while (typeof node.field === 'string' && node.arrayOperator && isLeaf(node.condition)) {
    chain.push(chain.length ? `${chain.at(-1)}.${node.field}` : node.field);
    node = node.condition as Record<string, unknown>;
  }
  if (typeof node.field === 'string' && node.arrayOperator)
    chain.push(chain.length ? `${chain.at(-1)}.${node.field}` : node.field);
  return chain;
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
    const chain = arrayChain({ ...leaf, field: rest } as Condition);
    for (const violation of checkRuleAgainstLens({ ...leaf, field: rest } as Condition, slot).violations) {
      if (crossings.has(violation.path)) continue;
      const within = chain.find((prefix) => violation.path === prefix || violation.path.startsWith(`${prefix}.`));
      const path =
        within || violation.path.startsWith('$') ? violation.path : `${chain.at(-1) ?? rest}.${violation.path}`;
      violations.push({ path: `${root}.${path}`, reason: violation.reason });
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

const mapRuleTree = (condition: Condition, map: (leaf: Condition) => Condition): Condition => {
  if (condition == null || typeof condition === 'boolean') return condition;
  const node = condition as Record<string, unknown>;
  for (const key of ['all', 'any']) {
    if (Array.isArray(node[key])) {
      return { ...node, [key]: (node[key] as Condition[]).map((child) => mapRuleTree(child, map)) } as Condition;
    }
  }
  if ('if' in node) {
    const out: Record<string, unknown> = { ...node };
    for (const key of ['if', 'then', 'else']) {
      if (node[key] !== undefined) out[key] = mapRuleTree(node[key] as Condition, map);
    }
    return out as Condition;
  }
  return map(condition);
};

const prefixed = (condition: Condition, root: string): Condition =>
  mapRuleTree(condition, (leaf) => (isLeaf(leaf) ? ({ ...leaf, field: `${root}.${leaf.field}` } as Condition) : leaf));

export const applyEmailLens = (lens: EmailLens, rule: Condition): Condition =>
  mapRuleTree(rule, (leaf) => {
    if (!isLeaf(leaf)) return leaf;
    const slice = sliceOf(lens, leaf);
    if (!slice || slice.slot === OPAQUE_SLOT || !slice.rest) return leaf;
    return prefixed(applyLens({ ...leaf, field: slice.rest } as Condition, slice.slot), slice.root);
  });

/** A loop-bound rule (see `scopedRule`) evaluates slot-relative, so its `$$` refs climb to the lens root. */
export const evaluateScopedRule = (
  lens: EmailLens,
  scoped: Condition,
  narrowed: Record<string, unknown>,
): boolean | string => {
  if (!isLeaf(scoped)) return check(applyEmailLens(lens, scoped), narrowed);
  const slice = sliceOf(lens, scoped);
  if (!slice || slice.slot === OPAQUE_SLOT || !slice.rest) return check(scoped, narrowed);
  const row = (narrowed[slice.root] ?? {}) as Record<string, unknown>;
  return check(applyLens({ ...scoped, field: slice.rest } as Condition, slice.slot), row);
};

export const emailSlotLenses = (lens: EmailLens): [ScopeRoot, RuleLens][] =>
  SCOPE_ROOTS.flatMap((root) => {
    const slot = lens[root];
    return slot && slot !== OPAQUE_SLOT ? [[root, slot] as [ScopeRoot, RuleLens]] : [];
  });

export const emailSourceQueries = (lens: EmailLens): SourceQuery[] =>
  emailSlotLenses(lens).flatMap(([, slot]) => sourceQueries(slot));

/** The variables a template renders with, projected through each slot: rows a `where` hides are gone before any token or rule reads them. */
export const narrowVariables = <V extends Record<string, unknown>>(lens: EmailLens, variables: V): V => {
  const out: Record<string, unknown> = { ...variables };
  for (const [root, slot] of emailSlotLenses(lens)) {
    const value = variables[root];
    if (value && typeof value === 'object') out[root] = prune(value as Record<string, unknown>, slot);
  }
  return out as V;
};

export const narrowEmailLens = (lens: EmailLens, narrow: (root: ScopeRoot, slot: RuleLens) => RuleLens): EmailLens => ({
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

export const parseSlotLenses = (raw: unknown): EmailSlotLenses => {
  if (!isNarrowing(raw)) return {};
  const doc = raw as Record<string, unknown>;
  const slots = (['recipient', 'sender', 'data'] as const).filter((root) => isNarrowing(doc[root]));
  return Object.fromEntries(slots.map((root) => [root, doc[root]]));
};
