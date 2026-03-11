export const searchableRelation = (relation: string, fields: readonly string[]): string[] =>
  fields.map((field) => `${relation}.${field}`);
