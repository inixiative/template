/**
 * Parses bracket notation query parameters into nested objects.
 * Supports arbitrary nesting levels.
 *
 * Examples:
 * - ?filters[status]=active → { filters: { status: 'active' } }
 * - ?searchFields[user][name][contains]=dragon → { searchFields: { user: { name: { contains: 'dragon' } } } }
 */
export const parseBracketNotation = (url: string): Record<string, any> => {
  const params = new URLSearchParams(url.split('?')[1] || '');
  const result: Record<string, any> = {};

  for (const [key, value] of params.entries()) {
    const bracketMatch = key.match(/^([^[]+)(\[[^\]]+\])+$/);
    if (!bracketMatch) continue;

    const keys = key.match(/[^[\]]+/g);
    if (!keys || keys.length < 2) continue;

    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    const decodedValue = decodeURIComponent(value.replace(/\+/g, ' ')).trim();
    current[keys[keys.length - 1]] = decodedValue;
  }

  return result;
};
