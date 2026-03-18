export type AdapterRegistry<A> = {
  register: (name: string, adapter: A) => void;
  get: (name: string) => A;
  getOrDefault: (name: string | undefined, fallback: string) => A;
  has: (name: string) => boolean;
  names: () => string[];
};

export const makeAdapterRegistry = <A>(): AdapterRegistry<A> => {
  const map = new Map<string, A>();
  return {
    register: (name, adapter) => {
      map.set(name, adapter);
    },
    get: (name) => {
      const adapter = map.get(name);
      if (!adapter) throw new Error(`Adapter not found: ${name}`);
      return adapter;
    },
    getOrDefault: (name, fallback) => {
      const adapter = name !== undefined ? map.get(name) : undefined;
      if (adapter) return adapter;
      const defaultAdapter = map.get(fallback);
      if (!defaultAdapter) throw new Error(`Default adapter not found: ${fallback}`);
      return defaultAdapter;
    },
    has: (name) => map.has(name),
    names: () => Array.from(map.keys()),
  };
};
