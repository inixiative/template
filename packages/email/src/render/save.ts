/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent, EmailOwnerModel, EmailTemplate } from '@template/db/generated/client/client';
import { IF, parseIfBlock } from '@template/email/render/conditionParser';
import { type ComponentWrite, collectSlugs, decompose } from '@template/email/render/decompose';
import { expand } from '@template/email/render/expand';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { saveComponents } from '@template/email/render/saveComponents';
import { saveTemplate } from '@template/email/render/saveTemplate';
import type { OwnerScope } from '@template/email/render/types';
import { assertValidConditions } from '@template/email/render/validateConditions';
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
  if (input.subject) assertValidConditions(input.subject, { isSubject: true });

  const ctx: OwnerScope = {
    ownerModel: input.ownerModel,
    organizationId: input.organizationId,
    spaceId: input.spaceId,
    locale: input.locale ?? 'en',
  };

  // Every referenced component slug, so we can diff each inlined body against the cascade.
  const slugs = collectSlugs(input.mjml);

  return db.txn(
    async () => {
      // The cascade body per slug (tenant → parent → platform) is the diff baseline: an inlined
      // body equal to it is a noop/inherit; a divergence (or an unknown slug) is a write at this tenant.
      const existing = await lookupCascade(slugs, ctx);
      const { mjml, refs, writes } = decompose(input.mjml, (slug) => existing[slug]?.mjml);

      // A slug defines one component (no variant-indexing) — collapse repeats, keeping child-first order.
      const bySlug = new Map<string, ComponentWrite>();
      for (const write of writes) bySlug.set(write.slug, write);
      const finalComponents = [...bySlug.values()].map((write) => ({
        slug: write.slug,
        locale: ctx.locale,
        mjml: write.mjml,
        componentRefs: [...new Set(write.refs)],
      })) as EmailComponent[];

      const finalTemplate = {
        ...input,
        mjml,
        componentRefs: [...new Set(refs)],
        locale: ctx.locale,
      } as EmailTemplate;

      // Cycle check before writes: defends against a cross-save cycle where this save's new edge
      // closes a loop with edges already in the DB (the intra-save graph is a tree by construction).
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
