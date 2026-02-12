export type SearchInput = string | URLSearchParams | Record<string, unknown> | null | undefined;

const readStringValue = (value: unknown): string | null => {
  return typeof value === 'string' && value.length > 0 ? value : null;
};

export const toUrlSearchParams = (search: SearchInput): URLSearchParams => {
  if (search instanceof URLSearchParams) {
    return new URLSearchParams(search);
  }

  if (typeof search === 'string') {
    return new URLSearchParams(search);
  }

  if (!search || typeof search !== 'object') {
    return new URLSearchParams();
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const stringValue = readStringValue(value);
    if (stringValue) {
      params.set(key, stringValue);
    }
  }
  return params;
};

export const readSearchParam = (search: SearchInput, key: string): string | null => {
  const params = toUrlSearchParams(search);
  return params.get(key);
};

export const pickSearchParams = (search: SearchInput, keys: readonly string[]): Record<string, string> | undefined => {
  const params = toUrlSearchParams(search);
  const picked: Record<string, string> = {};

  for (const key of keys) {
    const value = params.get(key);
    if (value) {
      picked[key] = value;
    }
  }

  return Object.keys(picked).length > 0 ? picked : undefined;
};

export const buildPathWithSearch = (pathname: string, search?: Record<string, string>): string => {
  if (!search) {
    return pathname;
  }

  const params = new URLSearchParams(search);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};
