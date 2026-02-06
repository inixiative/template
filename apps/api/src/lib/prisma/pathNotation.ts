export const buildNestedPath = (path: string, value: any): Record<string, any> => {
  const parts = path.split('.');

  if (parts.length === 1) {
    return { [path]: value };
  }

  const [first, ...rest] = parts;
  return { [first]: buildNestedPath(rest.join('.'), value) };
};

export const validatePathNotation = (path: string, maxDepth = 5): boolean => {
  if (!/^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/.test(path)) return false;
  if (path.split('.').length > maxDepth) return false;
  return true;
};
