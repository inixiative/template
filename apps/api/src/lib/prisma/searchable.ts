import { type ModelName, getRuntimeDataModel, isModelName, toModelName } from '@template/db';

type SearchableEntry = string | { [relation: string]: SearchableEntry | SearchableEntry[] };
type SearchableInput = { [model: string]: SearchableEntry[] };

const validateField = (modelName: ModelName, fieldName: string): { kind: 'scalar' | 'object' | 'enum'; type: string } => {
  const dataModel = getRuntimeDataModel();
  const model = dataModel.models[modelName];
  if (!model) throw new Error(`searchable: model '${modelName}' not found in Prisma schema`);
  const field = model.fields.find((f) => f.name === fieldName);
  if (!field) throw new Error(`searchable: field '${fieldName}' does not exist on model '${modelName}'`);
  return { kind: field.kind, type: field.type };
};

const flatten = (entries: SearchableEntry[], modelName: ModelName, prefix = ''): string[] =>
  entries.flatMap((entry) => {
    if (typeof entry === 'string') {
      const field = validateField(modelName, entry);
      if (field.kind === 'object') throw new Error(`searchable: '${entry}' on '${modelName}' is a relation — use { ${entry}: [...] } syntax`);
      return [prefix ? `${prefix}.${entry}` : entry];
    }
    return Object.entries(entry).flatMap(([relation, value]) => {
      const field = validateField(modelName, relation);
      if (field.kind !== 'object') throw new Error(`searchable: '${relation}' on '${modelName}' is not a relation`);
      const path = prefix ? `${prefix}.${relation}` : relation;
      const children = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [value];
      return flatten(children, field.type as ModelName, path);
    });
  });

export const searchable = (input: SearchableInput): readonly string[] => {
  const entries = Object.entries(input);
  if (entries.length !== 1) throw new Error('searchable: must provide exactly one model as root key');
  const [modelKey, fields] = entries[0];
  const modelName = isModelName(modelKey) ? modelKey : toModelName(modelKey);
  if (!modelName) throw new Error(`searchable: '${modelKey}' is not a valid Prisma model name`);
  return flatten(fields, modelName);
};
