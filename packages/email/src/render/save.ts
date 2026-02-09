/**
 * Save coordinator - resolves variants, rewrites MJML, saves.
 */

import type { EmailComponent, EmailOwnerModel, EmailTemplate } from '@template/db';
import { db } from '@template/db';
import { validateMjml } from '../validations/validateMjml';
import { mapRefs } from './extractRefs';
import { lookupCascade } from './lookupCascade';
import { resolveVariants } from './resolveVariants';
import { saveComponents } from './saveComponents';
import { saveTemplate } from './saveTemplate';
import type { SaveContext } from './types';

export type SaveTemplateInput = Partial<EmailTemplate> & {
  mjml: string;
  slug: string;
  ownerModel: EmailOwnerModel;
  organizationId?: string | null;
  spaceId?: string | null;
  locale?: string;
};

export type SaveTemplateResult = {
  template: EmailTemplate;
  components: EmailComponent[];
};

/**
 * Save a template - validates MJML, parses components, saves all.
 */
export const saveEmailTemplate = async (input: SaveTemplateInput): Promise<SaveTemplateResult> => {
  validateMjml(input.mjml);

  const ctx: SaveContext = {
    ownerModel: input.ownerModel,
    organizationId: input.organizationId,
    spaceId: input.spaceId,
    locale: input.locale ?? 'en',
  };

  // 1. Parse template MJML for component refs (sync, outside tx)
  const { map, mjml: indexedMjml, refs: templateRefs } = mapRefs(input.mjml);
  const baseSlugs = Object.keys(map);

  // 2. Lookup + resolve + save in transaction
  return db.txn(
    async () => {
      const existing = await lookupCascade(baseSlugs, ctx);
      const resolved = resolveVariants(map, indexedMjml, templateRefs, existing, ctx);

      const finalTemplate = { ...input, ...resolved.template, locale: ctx.locale } as EmailTemplate;
      const finalComponents = resolved.components as EmailComponent[];

      const [template, components] = await Promise.all([
        saveTemplate(finalTemplate, ctx),
        finalComponents.length ? saveComponents(finalComponents, ctx) : Promise.resolve([]),
      ]);

      return { template, components };
    },
    { timeout: 30_000 },
  );
};
