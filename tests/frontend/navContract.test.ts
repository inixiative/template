import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { navConfig as adminNavConfig } from '../../apps/admin/app/config/nav';
import { navConfig as webNavConfig } from '../../apps/web/app/config/nav';

const getRouteTargetsFromRouteTree = (filePath: string): Set<string> => {
  const source = readFileSync(filePath, 'utf8');
  const toMatch = source.match(/to:\s*([\s\S]*?)\n\s*id:/);
  if (!toMatch) return new Set();
  const targets = Array.from(toMatch[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
  return new Set(targets);
};

const joinNavPath = (parentPath: string | null, path: string): string => {
  if (!parentPath) return path;
  if (!path.startsWith('/')) return path;
  if (path.startsWith(`${parentPath}/`)) return path;
  if (parentPath === '/') return path;
  return `${parentPath}${path}`;
};

const flattenNavPaths = (items: Array<{ path?: string; items?: any[] }>): string[] => {
  const paths: string[] = [];
  const visit = (itemList: Array<{ path?: string; items?: any[] }>, parentPath: string | null = null) => {
    if (!itemList) return;
    for (const item of itemList) {
      const resolvedPath = item.path ? joinNavPath(parentPath, item.path) : parentPath;
      if (resolvedPath) paths.push(resolvedPath);
      if (item.items?.length) visit(item.items, resolvedPath);
    }
  };
  visit(items);
  return paths;
};

const normalizeNavPath = (path: string): string => {
  return path.replaceAll(':organizationId', '$organizationId').replaceAll(':spaceId', '$spaceId');
};

describe('frontend nav contract', () => {
  it('web nav paths resolve to generated route targets', () => {
    const routeTargets = getRouteTargetsFromRouteTree(resolve(process.cwd(), 'apps/web/app/routeTree.gen.ts'));
    const navPaths = flattenNavPaths([...webNavConfig.user, ...webNavConfig.organization, ...webNavConfig.space]);

    // Deduplicate paths (same path can appear in multiple contexts)
    const uniquePaths = [...new Set(navPaths)];
    const invalid = uniquePaths.filter((path) => !routeTargets.has(normalizeNavPath(path)));
    expect(invalid).toEqual([]);
  });

  it('admin nav paths resolve to generated route targets', () => {
    const routeTargets = getRouteTargetsFromRouteTree(resolve(process.cwd(), 'apps/admin/app/routeTree.gen.ts'));
    const navPaths = flattenNavPaths([
      ...adminNavConfig.user,
      ...adminNavConfig.organization,
      ...adminNavConfig.space,
    ]);

    // Deduplicate paths (same path can appear in multiple contexts)
    const uniquePaths = [...new Set(navPaths)];
    const invalid = uniquePaths.filter((path) => !routeTargets.has(normalizeNavPath(path)));
    expect(invalid).toEqual([]);
  });
});
