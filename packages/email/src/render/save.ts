import { db } from '@template/db';
import type { EmailComponent, EmailOwnerModel, EmailTemplate } from '@template/db/generated/client/client';
import { mapRefs } from '@template/email/render/extractRefs';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { resolveVariants } from '@template/email/render/resolveVariants';
import { saveComponents } from '@template/email/render/saveComponents';
import { saveTemplate } from '@template/email/render/saveTemplate';
import type { SaveContext } from '@template/email/render/types';
import { validateNoCycle } from '@template/email/render/validateNoCycle';
import { validateMjml } from '@template/email/validations/validateMjml';

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

export const saveEmailTemplate = async (input: SaveTemplateInput): Promise<SaveTemplateResult> => {
  await validateMjml(input.mjml);

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

      // Cycle check before writes. mapRefs guarantees the intra-save graph
      // is a tree (text-nested → can't self-reference); this defends against
      // cross-save cycles where this save's new edge closes a loop with
      // edges already in the DB.
      for (const component of finalComponents) {
        await validateNoCycle(component.slug, component.componentRefs ?? [], ctx);
      }

      const [template, components] = await Promise.all([
        saveTemplate(finalTemplate, ctx),
        finalComponents.length ? saveComponents(finalComponents, ctx) : Promise.resolve([]),
      ]);

      return { template, components };
    },
    { timeout: 30_000 },
  );
};
