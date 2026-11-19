/**
 * The schema facts CI detectors read: the Prisma models, the polymorphism registry's sides, and the
 * soft-delete models. One reader, so no detector parses them its own way.
 */
import ts from 'typescript';
import { fetchSource, lineAt, listFiles } from './ciRuleRunner';

export const POLYMORPHISM_REGISTRY = 'packages/db/src/registries/falsePolymorphism.ts';
const SOFT_DELETE_MODELS = 'packages/db/src/registries/softDeleteModels.ts';
const AUDIT_ENABLED_MODELS = 'packages/db/src/registries/auditEnabledModels.ts';

export type PrismaModel = {
  file: string;
  source: string;
  name: string;
  body: string;
  offset: number;
  bodyOffset: number;
};

export const readPrismaModels = (dirs: string[] = ['packages']): PrismaModel[] =>
  listFiles(dirs, /\.prisma$/).flatMap((file) => {
    const source = fetchSource(file);
    return [...source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => ({
      file,
      source,
      name: m[1] ?? '',
      body: m[2] ?? '',
      offset: m.index ?? 0,
      bodyOffset: (m.index ?? 0) + m[0].indexOf('{') + 1,
    }));
  });

export type PolymorphicSide = {
  model: string;
  field: string;
  dualPolymorphismId?: string;
  arms: { value: string; keys: string[] }[];
  line: number;
};

const unwrapExpression = (node: ts.Expression): ts.Expression =>
  ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)
    ? unwrapExpression(node.expression)
    : node;

const propertyOf = (node: ts.ObjectLiteralExpression, name: string) =>
  node.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === name,
  )?.initializer;

const stringLiteral = (node: ts.Node | undefined): string | undefined =>
  node && ts.isStringLiteral(node) ? node.text : undefined;

const parse = (file: string, text: string) =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

const initializerOf = (source: ts.SourceFile, name: string): ts.Expression | undefined => {
  let found: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name)
      found = node.initializer && unwrapExpression(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

/** Every side the registry declares. Throws when it finds none: a detector reading no sides passes vacuously. */
export const readPolymorphicSides = (): PolymorphicSide[] => {
  const text = fetchSource(POLYMORPHISM_REGISTRY);
  const source = parse(POLYMORPHISM_REGISTRY, text);
  const registry = initializerOf(source, 'PolymorphismRegistry');
  if (!registry || !ts.isObjectLiteralExpression(registry))
    throw new Error(
      `${POLYMORPHISM_REGISTRY}: PolymorphismRegistry is not an object literal this reader understands`,
    );
  const sides = registry.properties.flatMap((entry) => {
    if (!ts.isPropertyAssignment(entry) || !ts.isObjectLiteralExpression(entry.initializer))
      return [];
    const axes = propertyOf(entry.initializer, 'axes');
    if (!axes || !ts.isArrayLiteralExpression(axes)) return [];
    return axes.elements.filter(ts.isObjectLiteralExpression).map((axis) => {
      const fkMap = propertyOf(axis, 'fkMap');
      return {
        model: entry.name.getText(source),
        field: stringLiteral(propertyOf(axis, 'field')) ?? '',
        dualPolymorphismId: stringLiteral(propertyOf(axis, 'dualPolymorphismId')),
        arms:
          fkMap && ts.isObjectLiteralExpression(fkMap)
            ? fkMap.properties.filter(ts.isPropertyAssignment).map((arm) => ({
                value: arm.name.getText(source).replace(/^['"]|['"]$/g, ''),
                keys: ts.isArrayLiteralExpression(arm.initializer)
                  ? arm.initializer.elements.flatMap((key) => stringLiteral(key) ?? [])
                  : [],
              }))
            : [],
        line: lineAt(text, axis.getStart(source)),
      };
    });
  });
  if (sides.length === 0) throw new Error(`${POLYMORPHISM_REGISTRY}: read no polymorphic sides`);
  return sides;
};

const sourceIfPresent = (file: string): string | undefined => {
  try {
    return fetchSource(file);
  } catch {
    return undefined;
  }
};

const arrayElements = (file: string, name: string): ts.Expression[] => {
  const text = sourceIfPresent(file);
  if (text === undefined) return [];
  const array = initializerOf(parse(file, text), name);
  return array && ts.isArrayLiteralExpression(array) ? [...array.elements] : [];
};

/** Models that are never hard-deleted: the audit-enabled models and SOFT_DELETE_ONLY (registries/softDeleteModels.ts). */
export const readSoftDeleteModels = (): Set<string> =>
  new Set([
    ...arrayElements(SOFT_DELETE_MODELS, 'SOFT_DELETE_ONLY').flatMap((e) => stringLiteral(e) ?? []),
    ...arrayElements(AUDIT_ENABLED_MODELS, 'AUDIT_ENABLED_MODELS').flatMap((e) =>
      ts.isPropertyAccessExpression(e) ? [e.name.text] : (stringLiteral(e) ?? []),
    ),
  ]);
