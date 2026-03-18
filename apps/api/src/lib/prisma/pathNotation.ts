export const buildNestedPath = (path: string, value: unknown): Record<string, unknown> => {
  const parts = path.split('.');

  if (parts.length === 1) {
    return { [path]: value };
  }

  const [first, ...rest] = parts;
  return { [first]: buildNestedPath(rest.join('.'), value) };
};

export const validatePathNotation = (path: string, maxDepth = 5): boolean => {
  // Allow camelCase and Prisma meta-fields (_count, _max, etc.)
  // Rejects snake_case (underscores in middle of field names)
  // Examples: ✓ user.name ✓ organization._count ✗ user_name ✗ created_at
  if (!/^_?[a-zA-Z0-9]+(\._?[a-zA-Z0-9]+)*$/.test(path)) return false;
  if (path.split('.').length > maxDepth) return false;
  return true;
};
