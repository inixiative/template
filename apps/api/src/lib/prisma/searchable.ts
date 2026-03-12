type SearchableEntry = string | { [relation: string]: SearchableEntry | SearchableEntry[] };

const flatten = (entries: SearchableEntry[], prefix = ''): string[] =>
  entries.flatMap((entry) => {
    if (typeof entry === 'string') return [prefix ? `${prefix}.${entry}` : entry];
    return Object.entries(entry).flatMap(([relation, value]) => {
      const path = prefix ? `${prefix}.${relation}` : relation;
      if (typeof value === 'string') return [`${path}.${value}`];
      if (Array.isArray(value)) return flatten(value, path);
      return flatten([value], path);
    });
  });

export const searchable = (fields: SearchableEntry[]): string[] => flatten(fields);
