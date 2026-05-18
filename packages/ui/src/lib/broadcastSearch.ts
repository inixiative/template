import type { ModelName } from '@template/db';
import { isStringPath } from '@template/ui/lib/broadcastSearchFieldKind';

type Options = {
  model?: ModelName;
};

export const broadcastSearch = (
  term: string,
  paths: readonly string[],
  options: Options = {},
): { OR: Record<string, unknown>[] } | undefined => {
  const trimmed = term.trim();
  if (!trimmed || paths.length === 0) return undefined;

  const eligible = options.model ? paths.filter((p) => isStringPath(options.model as string, p)) : paths;
  if (eligible.length === 0) return undefined;

  return { OR: eligible.map((path) => buildPathClause(path, trimmed)) };
};

const buildPathClause = (path: string, term: string): Record<string, unknown> => {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) return {};

  // Innermost: { <leafField>: { contains: term, mode: 'insensitive' } }
  let node: Record<string, unknown> = {
    [segments[segments.length - 1]]: { contains: term, mode: 'insensitive' },
  };

  // Wrap each intermediate relation segment in a `some` (to-many).
  for (let i = segments.length - 2; i >= 0; i--) {
    node = { [segments[i]]: { some: node } };
  }
  return node;
};
