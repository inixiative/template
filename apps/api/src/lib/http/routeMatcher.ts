/**
 * @atlas
 * @kind util
 * @partOf primitive:routeTemplates
 * @uses none
 */
type ParsedRoutePattern = {
  method: string | null;
  segments: string[];
  prefixWildcard: boolean;
  suffixWildcard: string | null;
};

const normalizePatternPath = (path: string): string => {
  const collapsed = path.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 && collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
};

const normalizeRequestPath = (path: string): string => {
  const pathname = new URL(path.replace(/^\/+/, '/'), 'http://route').pathname.replace(
    /\/{2,}/g,
    '/',
  );
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
};

const parseRoutePattern = (pattern: string): ParsedRoutePattern => {
  const trimmed = pattern.trim();
  const spaceIndex = trimmed.indexOf(' ');
  const hasMethod = spaceIndex > 0;
  const rawMethod = hasMethod ? trimmed.slice(0, spaceIndex).toUpperCase() : null;
  const method = rawMethod && rawMethod !== '*' ? rawMethod : null;
  const rawPath = normalizePatternPath(hasMethod ? trimmed.slice(spaceIndex + 1).trim() : trimmed);

  if (rawPath.endsWith('*') && !rawPath.endsWith('/*')) {
    return {
      method,
      segments: [],
      prefixWildcard: false,
      suffixWildcard: rawPath.slice(0, -1),
    };
  }

  const prefixWildcard = rawPath.endsWith('/*');
  const basePath = prefixWildcard ? rawPath.slice(0, -2) : rawPath;
  const segments = basePath.split('/').filter(Boolean);

  return { method, segments, prefixWildcard, suffixWildcard: null };
};

const isParamSegment = (segment: string): boolean =>
  segment === '*' || (segment.startsWith('{') && segment.endsWith('}'));

const matchesParsedPattern = (
  method: string,
  normalizedPath: string,
  pathSegments: string[],
  parsed: ParsedRoutePattern,
): boolean => {
  if (parsed.method && parsed.method !== method.toUpperCase()) return false;
  if (parsed.suffixWildcard !== null) return normalizedPath.startsWith(parsed.suffixWildcard);

  if (parsed.prefixWildcard) {
    if (pathSegments.length <= parsed.segments.length) return false;
  } else if (pathSegments.length !== parsed.segments.length) {
    return false;
  }

  for (let i = 0; i < parsed.segments.length; i += 1) {
    const expected = parsed.segments[i]!;
    if (!isParamSegment(expected) && expected !== pathSegments[i]) return false;
  }

  return true;
};

export const matchesRoutePattern = (method: string, path: string, pattern: string): boolean => {
  const normalizedPath = normalizeRequestPath(path);
  const pathSegments = normalizedPath.split('/').filter(Boolean);
  return matchesParsedPattern(method, normalizedPath, pathSegments, parseRoutePattern(pattern));
};

export const makeRouteMatcher = (patterns: readonly string[]) => {
  const parsed = patterns.map(parseRoutePattern);
  return (method: string, path: string): boolean => {
    const normalizedPath = normalizeRequestPath(path);
    const pathSegments = normalizedPath.split('/').filter(Boolean);
    return parsed.some((entry) =>
      matchesParsedPattern(method, normalizedPath, pathSegments, entry),
    );
  };
};
