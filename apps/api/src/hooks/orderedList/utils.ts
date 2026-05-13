import { orderedListRegistry } from '#/hooks/orderedList/registry';

export const extractRows = (args: unknown): Record<string, unknown>[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return Array.isArray(a.data) ? (a.data as Record<string, unknown>[]) : [a.data as Record<string, unknown>];
};

export const isRegistered = (model: string | undefined): boolean =>
  !!model && !!orderedListRegistry[model];
