/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent, EmailOwnerModel, EmailTemplate } from '@template/db/generated/client/client';
import { IF, parseIfBlock } from '@template/email/render/conditionParser';
import { expand } from '@template/email/render/expand';
import { mapRefs } from '@template/email/render/extractRefs';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { resolveVariants } from '@template/email/render/resolveVariants';
import { saveComponents } from '@template/email/render/saveComponents';
import { saveTemplate } from '@template/email/render/saveTemplate';
import type { OwnerScope } from '@template/email/render/types';
import { assertValidConditions } from '@template/email/render/validateConditions';
import { assertValidLenses } from '@template/email/render/validateLenses';
import { assertValidMatrix } from '@template/email/render/validateMatrix';
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

// Strip {{#if rule=…}}…{{/if}} blocks so a link that only renders conditionally doesn't satisfy the
// unsubscribe requirement — the link must be unconditional. Uses the canonical string-aware, depth-aware
// parser (not a brace-naive regex) so a rule-JSON value containing a literal {{/if}} can't fool it.
const withoutConditionals = (mjml: string): string => {
  let out = '';
  let i = 0;
  while (i < mjml.length) {
    const open = mjml.indexOf(IF, i);
    if (open === -1) {
      out += mjml.slice(i);
      break;
    }
    out += mjml.slice(i, open);
    const block = parseIfBlock(mjml, open);
    i = block ? block.end : open + IF.length;
  }
  return out;
};

export const saveEmailTemplate = async (input: SaveTemplateInput): Promise<SaveTemplateResult> => {
  await validateMjml(input.mjml);
  // Fail fast on broken conditional rules instead of shipping a silent render-time time-bomb.
  // Subjects are interpolated too, so they carry conditionals and need the same floor.
  assertValidConditions(input.mjml);
  if (input.subject) assertValidConditions(input.subject);
  // Structural floor for send governance (COMM-010): well-formed named lenses (recipient lenses are
  // parent: User with the delivery leaf) and a matrix whose keys all reference declared lenses. Model/
  // field-level checks against the real catalog are the api boundary's job (lens-scoped, slice 2).
  assertValidLenses(input.lenses);
  assertValidMatrix(input.matrix, input.lenses);

  const ctx: OwnerScope = {
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

      const components = finalComponents.length ? await saveComponents(finalComponents, ctx) : [];
      const template = await saveTemplate(finalTemplate, ctx);

      // Non-system kinds are subject to unsubscribe compliance: the composed body (template +
      // expanded components) must carry the unsubscribe link variable. Throws → rolls back the save.
      if (template.kind && template.kind !== 'system') {
        const composed = await expand(template.mjml, ctx);
        if (!withoutConditionals(composed).includes('{{system.unsubscribeUrl}}')) {
          throw new Error(
            `Non-system email template "${template.slug}" must include an unconditional unsubscribe link {{system.unsubscribeUrl}}.`,
          );
        }
      }

      return { template, components };
    },
    { timeout: 30_000 },
  );
};
