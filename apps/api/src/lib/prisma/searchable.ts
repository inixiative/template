import { getRuntimeDataModel, isModelName, type ModelName, toModelName } from '@template/db';

type SearchableEntry = string | { [relation: string]: SearchableEntry | SearchableEntry[] };
type SearchableInput = { [model: string]: SearchableEntry[] };

const getField = (modelName: ModelName, fieldName: string) => {
  const model = getRuntimeDataModel().models[modelName];
  if (!model) throw new Error(`searchable: unknown model '${modelName}'`);
  const field = model.fields.find((f) => f.name === fieldName);
  if (!field) throw new Error(`searchable: '${fieldName}' does not exist on '${modelName}'`);
  return field;
};

const flatten = (entry: SearchableEntry | SearchableEntry[], modelName: ModelName, prefix = ''): string[] => {
  if (Array.isArray(entry)) return entry.flatMap((e) => flatten(e, modelName, prefix));
  if (typeof entry === 'string') {
    const field = getField(modelName, entry);
    if (field.kind === 'object')
      throw new Error(`searchable: '${entry}' on '${modelName}' is a relation — use { ${entry}: [...] } syntax`);
    return [prefix ? `${prefix}.${entry}` : entry];
  }
  return Object.entries(entry).flatMap(([relation, value]) => {
    const field = getField(modelName, relation);
    if (field.kind !== 'object') throw new Error(`searchable: '${relation}' on '${modelName}' is not a relation`);
    return flatten(value, field.type as ModelName, prefix ? `${prefix}.${relation}` : relation);
  });
};

export const searchable = (input: SearchableInput): readonly string[] => {
  const entries = Object.entries(input);
  if (entries.length !== 1) throw new Error('searchable: must provide exactly one model as root key');
  const [modelKey, fields] = entries[0];
  const modelName = isModelName(modelKey) ? modelKey : toModelName(modelKey);
  if (!modelName) throw new Error(`searchable: '${modelKey}' is not a valid Prisma model name`);
  return flatten(fields, modelName);
};
