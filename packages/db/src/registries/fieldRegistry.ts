/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
export type FieldRegistry = Record<string, string[]>;

export const unionRegistries = (...registries: FieldRegistry[]): FieldRegistry => {
  const merged: FieldRegistry = {};
  for (const registry of registries) {
    for (const [model, fields] of Object.entries(registry)) {
      merged[model] = [...new Set([...(merged[model] ?? []), ...fields])];
    }
  }
  return merged;
};
