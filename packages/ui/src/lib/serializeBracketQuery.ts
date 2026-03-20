/**
 * Converts a nested filter object to URLSearchParams with repeated keys for arrays.
 *
 * Input:  { searchFields: { type: { in: ['foo', 'bar'] }, status: { notIn: ['baz'] } } }
 * Output: searchFields[type][in]=foo&searchFields[type][in]=bar&searchFields[status][notIn]=baz
 */
export const serializeBracketQuery = (obj: Record<string, unknown>, prefix = ''): URLSearchParams => {
  const params = new URLSearchParams();
  const append = (key: string, val: unknown) => {
    if (Array.isArray(val)) {
      for (const item of val) params.append(key, String(item));
    } else if (val !== null && typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        append(`${key}[${k}]`, v);
      }
    } else if (val !== undefined) {
      params.append(key, String(val));
    }
  };
  for (const [k, v] of Object.entries(obj)) {
    append(prefix ? `${prefix}[${k}]` : k, v);
  }
  return params;
};
