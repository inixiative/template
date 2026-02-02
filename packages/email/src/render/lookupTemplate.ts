/**
 * Cascade lookup for template or component: Space → Org → default
 */

import { db } from '@template/db';
import type { EmailTemplate, EmailComponent } from '@template/db';
import type { SaveContext } from './types';
import { lookupAtSpace, lookupAtOrg, lookupAtDefault, lookupAtAdmin } from './lookup';

type LookupFn<T> = () => Promise<T | null | undefined>;

const getTemplateLookups = (slug: string, ctx: SaveContext): LookupFn<EmailTemplate>[] => {
  switch (ctx.ownerModel) {
    case 'Space':
      return [
        () => lookupAtSpace(db, slug, [], ctx).then((r) => r.template),
        () => lookupAtOrg(db, slug, [], ctx, true).then((r) => r.template),
        () => lookupAtDefault(db, slug, [], ctx).then((r) => r.template),
      ];
    case 'Organization':
      return [
        () => lookupAtOrg(db, slug, [], ctx).then((r) => r.template),
        () => lookupAtDefault(db, slug, [], ctx).then((r) => r.template),
      ];
    case 'admin':
      return [() => lookupAtAdmin(db, slug, [], ctx).then((r) => r.template)];
    case 'default':
      return [() => lookupAtDefault(db, slug, [], ctx).then((r) => r.template)];
  }
};

const getComponentLookups = (slug: string, ctx: SaveContext): LookupFn<EmailComponent>[] => {
  switch (ctx.ownerModel) {
    case 'Space':
      return [
        () => lookupAtSpace(db, null, [slug], ctx).then((r) => r.components[slug]),
        () => lookupAtOrg(db, null, [slug], ctx, true).then((r) => r.components[slug]),
        () => lookupAtDefault(db, null, [slug], ctx).then((r) => r.components[slug]),
      ];
    case 'Organization':
      return [
        () => lookupAtOrg(db, null, [slug], ctx).then((r) => r.components[slug]),
        () => lookupAtDefault(db, null, [slug], ctx).then((r) => r.components[slug]),
      ];
    case 'admin':
      return [() => lookupAtAdmin(db, null, [slug], ctx).then((r) => r.components[slug])];
    case 'default':
      return [() => lookupAtDefault(db, null, [slug], ctx).then((r) => r.components[slug])];
  }
};

export const lookupTemplate = async (slug: string, ctx: SaveContext): Promise<EmailTemplate | null> => {
  for (const lookup of getTemplateLookups(slug, ctx)) {
    const result = await lookup();
    if (result) return result;
  }
  return null;
};

export const lookupComponent = async (slug: string, ctx: SaveContext): Promise<EmailComponent | null> => {
  for (const lookup of getComponentLookups(slug, ctx)) {
    const result = await lookup();
    if (result) return result;
  }
  return null;
};
