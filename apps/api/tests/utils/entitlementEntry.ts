export type Entry = {
  resource: string;
  anchor: { resource: string; id: string };
  actions: Record<string, boolean>;
};

export const entry = (resource: string, anchor: [string, string], actions: string[]): Entry => ({
  resource,
  anchor: { resource: anchor[0], id: anchor[1] },
  actions: Object.fromEntries(actions.map((action) => [action, true])),
});
