/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses none
 */
import { lookupField } from '#/lib/prisma/fieldMetadata';

export const buildSearchPath = (
  model: string,
  path: string,
  clause: Record<string, unknown>,
): Record<string, unknown> => {
  const [seg = '', ...rest] = path.split('.');
  if (!rest.length) return { [seg]: clause };

  const field = lookupField(model, seg)!;
  const inner = buildSearchPath(field.type, rest.join('.'), clause);
  return { [seg]: field.kind === 'object' && field.isList ? { some: inner } : inner };
};
