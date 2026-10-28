export type Entry = {
  resource: string;
  anchor: { resource: string; id: string; path?: string };
  actions: Record<string, boolean>;
  where?: { [key: string]: string | null | { [key: string]: string }[] };
};

export const entry = (
  resource: string,
  [anchorResource, id, path]: [string, string, string?],
  actions: string[],
): Entry => ({
  resource,
  anchor: { resource: anchorResource, id, ...(path ? { path } : {}) },
  actions: Object.fromEntries(actions.map((action) => [action, true])),
});
