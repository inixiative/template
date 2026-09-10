/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent, EmailOwnerModel, EmailTemplate } from '@template/db/generated/client/client';
import { IF, parseIfBlock } from '@template/email/render/conditionParser';
import { decomposeNodes } from '@template/email/render/decompose';
import { expand } from '@template/email/render/expand';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { collectSlugsFromNodes } from '@template/email/render/nodes';
import { parseBlocks } from '@template/email/render/parseBlocks';
import { saveComponents } from '@template/email/render/saveComponents';
import { saveTemplate } from '@template/email/render/saveTemplate';
import type { OwnerScope } from '@template/email/render/types';
import { assertValidConditions } from '@template/email/validations/validateConditions';
import { validateMjml } from '@template/email/validations/validateMjml';
import { validateNoCycle } from '@template/email/validations/validateNoCycle';

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
  const nodes = parseBlocks(input.mjml);
  assertValidConditions(input.mjml);
  if (input.subject) assertValidConditions(input.subject, { isSubject: true });

  const ctx: OwnerScope = {
    ownerModel: input.ownerModel,
    organizationId: input.organizationId,
    spaceId: input.spaceId,
    locale: input.locale ?? 'en',
  };

  const slugs = collectSlugsFromNodes(nodes);

  return db.txn(
    async () => {
      const existing = await lookupCascade(slugs, ctx);
      const { mjml, refs, writes } = decomposeNodes(nodes, (slug) => existing[slug]?.mjml);

      const finalComponents = writes.map((write) => ({
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

      for (const component of finalComponents) {
        await validateNoCycle(component.slug, component.componentRefs ?? [], ctx);
      }

      const components = finalComponents.length ? await saveComponents(finalComponents, ctx) : [];
      const template = await saveTemplate(finalTemplate, ctx);

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
