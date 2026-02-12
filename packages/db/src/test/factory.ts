/**
 * Test Factory System
 *
 * Creates test entities with automatic dependency resolution.
 *
 * ## Triggering Optional Dependencies
 *
 * For optional dependencies (required: false), pass an empty object in overrides
 * to trigger creation:
 *
 *   tokenFactory.build({ organizationUser: {} })
 *
 * This follows Prisma's nested create pattern. Alternative API designs considered:
 *   - Boolean trigger: `{ organizationUser: true }`
 *   - Explicit array: `{ $create: ['organizationUser'] }`
 *   - Symbol marker: `{ organizationUser: CREATE }`
 *
 * ## Future: Reference Existing Entities
 *
 * Could support passing existing entity or unique field to link instead of create:
 *   - Pass entity: `{ user: existingUser }`
 *   - Pass unique field: `{ organization: { ref: { slug: 'acme' } } }`
 *   - Explicit create vs ref: `{ user: { create: {} } }` vs `{ user: { ref: { id } } }`
 *
 * Current approach chosen for familiarity with Prisma's `{ relation: { create: {} } }`.
 * Revisit if API feels awkward in practice.
 */

import { faker } from '@faker-js/faker';
import { db } from '@template/db/client';
import { mergeDependencies } from '@template/db/test/dependencyInference';
import type {
  BuildContext,
  BuildResult,
  CreateInputOf,
  DependencyConfig,
  Factory,
  FactoryConfig,
  ModelName,
  ModelOf,
} from '@template/db/test/factoryTypes';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { toAccessor } from '@template/db/utils/modelNames';
import { getRuntimeDataModel } from '@template/db/utils/runtimeDataModel';

/**
 * Converts Date fields to ISO strings for API compatibility
 * Recursively handles nested objects and arrays
 */
const serializeEntity = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeEntity(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip non-enumerable properties like __serialize itself
      if (Object.prototype.propertyIsEnumerable.call(obj, key)) {
        result[key] = serializeEntity(value);
      }
    }
    return result;
  }

  return obj;
};

const autoInjectDbFields = (modelName: ModelName): Record<string, unknown> => {
  const dataModel = getRuntimeDataModel();
  const model = dataModel.models[modelName];
  if (!model) return {};

  const fieldNames = new Set(model.fields.map((f) => f.name));
  const injected: Record<string, unknown> = {};

  if (fieldNames.has('id')) injected.id = faker.string.uuid();
  if (fieldNames.has('createdAt')) injected.createdAt = new Date();
  if (fieldNames.has('updatedAt')) injected.updatedAt = new Date();
  if (fieldNames.has('deletedAt')) injected.deletedAt = null;

  return injected;
};

// Random offset ensures uniqueness across test runs even if cleanup fails
const sessionOffset = Math.floor(Math.random() * 1_000_000);
let globalSeq = sessionOffset;

export const getNextSeq = () => ++globalSeq;
export const resetSequence = () => {
  globalSeq = sessionOffset;
};

type RegisteredFactory = {
  defaults: () => Partial<unknown>;
  dependencies: Record<string, DependencyConfig>;
};

const factoryRegistry = new Map<ModelName, RegisteredFactory>();

export const createFactory = <K extends ModelName>(modelName: K, config: FactoryConfig<K>): Factory<K> => {
  const dependencies = mergeDependencies(modelName, config.dependencies);

  factoryRegistry.set(modelName, {
    defaults: config.defaults as () => Partial<unknown>,
    dependencies,
  });

  const generate = async (
    persist: boolean,
    overrides?: Partial<CreateInputOf<K>>,
    context?: BuildContext,
  ): Promise<BuildResult<K>> => {
    const ctx: BuildContext = context ?? {};

    const scalarFields: Record<string, unknown> = {};
    const relationFields: Record<string, unknown> = {};

    if (overrides) {
      for (const key in overrides) {
        if (dependencies[key]) {
          relationFields[key] = overrides[key as keyof typeof overrides];
        } else {
          scalarFields[key] = overrides[key as keyof typeof overrides];
        }
      }
    }

    const merged: Record<string, unknown> = {
      ...autoInjectDbFields(modelName),
      ...config.defaults(),
      ...scalarFields,
    };

    for (const [fieldName, dep] of Object.entries(dependencies)) {
      const relationValue = relationFields[fieldName];
      const registered = factoryRegistry.get(dep.modelName);

      if (!registered) {
        throw new Error(`Dependency factory not registered: ${dep.modelName}. Import it before using.`);
      }

      const depAccessor = toAccessor(dep.modelName);

      if (relationValue !== undefined) {
        // If passing an existing entity (has .id), use it directly
        if (typeof relationValue === 'object' && relationValue !== null && 'id' in relationValue) {
          (ctx as Record<string, unknown>)[depAccessor] = relationValue;
        } else {
          const depFactory = createFactory(dep.modelName, {
            defaults: registered.defaults as () => Partial<CreateInputOf<typeof dep.modelName>>,
          });
          await (persist
            ? depFactory.create(relationValue as never, ctx)
            : depFactory.build(relationValue as never, ctx));
        }
      } else if (!ctx[depAccessor] && dep.required) {
        const depFactory = createFactory(dep.modelName, {
          defaults: registered.defaults as () => Partial<CreateInputOf<typeof dep.modelName>>,
        });
        await (persist ? depFactory.create(undefined, ctx) : depFactory.build(undefined, ctx));
      }

      if (dep.foreignKey && ctx[depAccessor]) {
        const depEntity = ctx[depAccessor] as Record<string, unknown>;

        if (typeof dep.foreignKey === 'string') {
          // Simple: source = target (e.g., "organizationId")
          merged[dep.foreignKey] = depEntity[dep.foreignKey];
        } else {
          // Mapped: { targetField: sourceField }
          // e.g., { id: "userId" } means set merged.userId = depEntity.id
          for (const [targetField, sourceField] of Object.entries(dep.foreignKey)) {
            merged[sourceField] = depEntity[targetField];
          }
        }
      }
    }

    const entity: ModelOf<K> = persist
      ? ((await (db[toAccessor(modelName)] as unknown as RuntimeDelegate).create({ data: merged })) as ModelOf<K>)
      : (merged as ModelOf<K>);

    // Add non-enumerable __serialize() method to convert Date fields to ISO strings
    Object.defineProperty(entity, '__serialize', {
      value: function __serialize() {
        return serializeEntity(this);
      },
      enumerable: false,
      writable: false,
      configurable: true,
    });

    // Type assertion needed because __serialize() is added at runtime
    const entityWithSerialize = entity as ModelOf<K> & { __serialize(): unknown };

    (ctx as Record<string, unknown>)[toAccessor(modelName)] = entityWithSerialize;

    return { entity: entityWithSerialize, context: ctx };
  };

  return {
    build: (overrides, context) => generate(false, overrides, context),
    create: (overrides, context) => generate(true, overrides, context),
  };
};
