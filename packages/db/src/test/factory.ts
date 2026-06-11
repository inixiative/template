/**
 * @atlas
 * @partOf infrastructure:prisma
 */
import { db } from '@template/db/client';
import { PolymorphismRegistry } from '@template/db/registries/falsePolymorphism';
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
  Serialized,
} from '@template/db/test/factoryTypes';
import type { RuntimeDelegate } from '@template/db/utils/delegates';
import { toAccessor } from '@template/db/utils/modelNames';
import { getRuntimeDataModel } from '@template/db/utils/runtimeDataModel';
import { uuidv7 } from 'uuidv7';

const serializeEntity = <T>(obj: T): Serialized<T> => {
  if (obj === null || obj === undefined) {
    return obj as Serialized<T>;
  }

  if (obj instanceof Date) {
    return obj.toISOString() as Serialized<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeEntity(item)) as Serialized<T>;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip non-enumerable properties like __serialize itself
      if (Object.prototype.propertyIsEnumerable.call(obj, key)) {
        result[key] = serializeEntity(value);
      }
    }
    return result as Serialized<T>;
  }

  return obj as Serialized<T>;
};

const autoInjectDbFields = (modelName: ModelName): Record<string, unknown> => {
  const dataModel = getRuntimeDataModel();
  const model = dataModel.models[modelName];
  if (!model) return {};

  const fieldNames = new Set(model.fields.map((f) => f.name));
  const injected: Record<string, unknown> = {};

  // uuidv7 (not faker's v4) — matches the schema's `dbgenerated("uuidv7()")`
  // default, so factory-created rows share the same id format as production
  // rows. The middleware enforces v7 when addressing rows by `:id`.
  if (fieldNames.has('id')) injected.id = uuidv7();
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

  const generate = async <O extends Partial<CreateInputOf<K>> | undefined>(
    persist: boolean,
    overrides?: O,
    context?: BuildContext,
  ): Promise<BuildResult<K, O>> => {
    const ctx: BuildContext = context ?? {};

    const scalarFields: Record<string, unknown> = {};
    const relationFields: Record<string, unknown> = {};

    if (overrides) {
      const overrideEntries = overrides as Record<string, unknown>;
      for (const key in overrideEntries) {
        const overrideValue = overrideEntries[key];
        if (dependencies[key]) {
          relationFields[key] = overrideValue;
        } else {
          scalarFields[key] = overrideValue;
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

        // Two protections layered here:
        // 1. Scalar overrides win — when a model has two deps that share a
        //    modelName (e.g. Inquiry's sourceUser + targetUser both → User),
        //    they also share `ctx[depAccessor]`, so the second iteration
        //    would clobber an explicit FK override.
        // 2. Polymorphism gate — for polymorphic models, an FK is only valid
        //    when the discriminator value selects it. Don't auto-pull a FK
        //    from incidental ctx if the discriminator forbids it (e.g.
        //    Inquiry { targetModel: 'admin' } must not gain a
        //    targetOrganizationId just because orgCtx carries one).
        const polyConfig = PolymorphismRegistry[modelName];
        const fkAllowed = (fkField: string): boolean => {
          if (!polyConfig) return true;
          const axis = polyConfig.axes.find((a) => Object.values(a.fkMap).flat().includes(fkField));
          if (!axis) return true;
          const discriminator = merged[axis.field] as string | undefined;
          if (!discriminator) return true;
          return (axis.fkMap[discriminator as keyof typeof axis.fkMap] ?? []).includes(fkField);
        };

        if (typeof dep.foreignKey === 'string') {
          if (!(dep.foreignKey in scalarFields) && fkAllowed(dep.foreignKey)) {
            merged[dep.foreignKey] = depEntity[dep.foreignKey];
          }
        } else {
          for (const [targetField, sourceField] of Object.entries(dep.foreignKey)) {
            if (sourceField in scalarFields) continue;
            if (!fkAllowed(sourceField)) continue;
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
    const entityWithSerialize = entity as BuildResult<K, O>['entity'];

    (ctx as Record<string, unknown>)[toAccessor(modelName)] = entityWithSerialize;

    return { entity: entityWithSerialize, context: ctx } as BuildResult<K, O>;
  };

  return {
    build: (overrides, context) => generate(false, overrides, context),
    create: (overrides, context) => generate(true, overrides, context) as Promise<BuildResult<K>>,
  };
};
