/**
 * @atlas
 * @kind registry
 * @uses infrastructure:prisma
 */
import { ATTRIBUTE_MODELS, type ModelName, relationsOfModel, toModelName } from '@template/db';
import { polymorphismImmutableFields } from '#/hooks/falsePolymorphism/toImmutableFields';

// Fields that should never be modified on any model
const GLOBAL_IMMUTABLE_FIELDS = ['id', 'createdAt'] as const;

type ImmutableFieldsOverride = {
  exclude?: string[];
  include?: string[];
  refuse?: string[];
};

const baseImmutableFieldsOverrides: Partial<Record<ModelName, ImmutableFieldsOverride>> = {
  ...polymorphismImmutableFields,
  Space: { exclude: ['organizationId'] },
  // A changed entitlement is a removed row and a new one; only its tombstones move.
  Entitlement: {
    include: polymorphismImmutableFields.Entitlement?.include,
    refuse: [
      ...(polymorphismImmutableFields.Entitlement?.refuse ?? []),
      'resource',
      'actions',
      'where',
      'lens',
      'sourcePath',
    ],
  },
  Tag: {
    ...polymorphismImmutableFields.Tag,
    refuse: [...(polymorphismImmutableFields.Tag?.refuse ?? []), 'tagCategoryId'],
  },
  Integration: {
    ...polymorphismImmutableFields.Integration,
    refuse: [...(polymorphismImmutableFields.Integration?.refuse ?? []), 'provider'],
  },
  ProjectIntegration: {
    refuse: ['projectId', 'integrationId'],
  },
  CommunicationLog: {
    ...polymorphismImmutableFields.CommunicationLog,
    exclude: ['emailTemplateId', 'emailTemplateAuditLogId'],
  },
  WebhookSubscription: {
    ...polymorphismImmutableFields.WebhookSubscription,
    include: [...(polymorphismImmutableFields.WebhookSubscription?.include ?? []), 'resourceModel'],
  },
  Passkey: {
    refuse: ['credentialId', 'publicKey', 'rpId'],
  },
};

export const ImmutableFieldsOverrides: Partial<Record<ModelName, ImmutableFieldsOverride>> = {
  ...baseImmutableFieldsOverrides,
  ...Object.fromEntries(
    Object.entries(ATTRIBUTE_MODELS).map(([accessor, config]) => {
      const modelName = toModelName(accessor);
      const existing = baseImmutableFieldsOverrides[modelName];
      return [
        modelName,
        {
          ...existing,
          refuse: [
            ...new Set([
              ...(existing?.refuse ?? []),
              ...(config.locatorField ? [config.locatorField] : []),
            ]),
          ],
        },
      ];
    }),
  ),
};

const inferForeignKeyFields = (modelName: ModelName): string[] => {
  const relations = relationsOfModel(modelName);
  const fields: string[] = [];

  for (const r of relations) {
    if (!r.foreignKey) continue;
    if (typeof r.foreignKey === 'string') {
      // Simple FK: the string is the field name
      fields.push(r.foreignKey);
    } else {
      // Object FK: values are the source field names (e.g., { id: 'userId' } → 'userId')
      fields.push(...Object.values(r.foreignKey));
    }
  }

  return fields;
};

const immutableFieldsCache = new Map<ModelName, readonly string[]>();

export const clearImmutableFieldsCache = (model?: ModelName): void => {
  if (model) immutableFieldsCache.delete(model);
  else immutableFieldsCache.clear();
};

export const setImmutableFieldsCache = (model: ModelName, fields: readonly string[]): void => {
  immutableFieldsCache.set(model, fields);
};

export const immutableFieldsForModel = (model: ModelName): readonly string[] => {
  if (immutableFieldsCache.has(model)) return immutableFieldsCache.get(model)!;

  const inferred = inferForeignKeyFields(model);
  const overrides = ImmutableFieldsOverrides[model];

  let fields = [...GLOBAL_IMMUTABLE_FIELDS, ...inferred];
  if (overrides?.exclude?.length) fields = fields.filter((f) => !overrides.exclude!.includes(f));
  if (overrides?.include?.length) fields = [...fields, ...overrides.include];

  const result = [...new Set(fields)];
  immutableFieldsCache.set(model, result);
  return result;
};

export const fieldsRefusedAfterCreate = (model: ModelName): readonly string[] =>
  ImmutableFieldsOverrides[model]?.refuse ?? [];
