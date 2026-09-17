/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { EmailComponent, EmailOwnerModel, EmailTemplate } from '@template/db/generated/client/client';
import { EACH, IF, parseEachBlock, parseIfBlock } from '@template/email/render/conditionParser';
import { decomposeNodes } from '@template/email/render/decompose';
import { expand } from '@template/email/render/expand';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { collectSlugsFromNodes } from '@template/email/render/nodes';
import { parseBlocks } from '@template/email/render/parseBlocks';
import { saveComponents } from '@template/email/render/saveComponents';
import { saveTemplate } from '@template/email/render/saveTemplate';
import { stripComponentBodies } from '@template/email/render/stripComponentBodies';
import type { OwnerScope } from '@template/email/render/types';
import { validateDependents } from '@template/email/render/validateDependents';
import { emailRuleNarrowing, syncRuleReferences } from '@template/email/rules';
import { assertValidConditions } from '@template/email/validations/validateConditions';
import { validateMjml } from '@template/email/validations/validateMjml';
import { validateNoCycle } from '@template/email/validations/validateNoCycle';
import { assertValidTokens } from '@template/email/validations/validateTokens';

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

export type LensForSlug = (slug: string, locale: string) => Promise<Lens | LensNarrowing | undefined>;

export type SaveTemplateOptions = {
  lens?: Lens | LensNarrowing;
  lensFor?: LensForSlug;
};

const withoutConditionals = (mjml: string): string => {
  let out = '';
  let i = 0;
  while (i < mjml.length) {
    const ifIdx = mjml.indexOf(IF, i);
    const eachIdx = mjml.indexOf(EACH, i);
    if (ifIdx === -1 && eachIdx === -1) {
      out += mjml.slice(i);
      break;
    }
    const isEach = eachIdx !== -1 && (ifIdx === -1 || eachIdx < ifIdx);
    const open = isEach ? eachIdx : ifIdx;
    out += mjml.slice(i, open);
    const block = isEach ? parseEachBlock(mjml, open) : parseIfBlock(mjml, open);
    i = block ? block.end : open + (isEach ? EACH.length : IF.length);
  }
  return out;
};

export const saveEmailTemplate = async (
  input: SaveTemplateInput,
  options: SaveTemplateOptions = {},
): Promise<SaveTemplateResult> => {
  await validateMjml(input.mjml);
  const nodes = parseBlocks(input.mjml);
  assertValidConditions(input.mjml, { lens: options.lens });
  if (input.subject) assertValidConditions(input.subject, { isSubject: true, lens: options.lens });

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

      for (const component of components) {
        await syncRuleReferences({ model: 'EmailComponent', id: component.id }, [component.mjml], emailRuleNarrowing);
      }
      await syncRuleReferences(
        { model: 'EmailTemplate', id: template.id },
        [template.subject ?? '', stripComponentBodies(template.mjml)],
        emailRuleNarrowing,
      );

      const composed = await expand(template.mjml, ctx);
      assertValidTokens(composed, { lens: options.lens });
      if (template.subject) assertValidTokens(template.subject, { lens: options.lens, isSubject: true });

      if (template.kind && template.kind !== 'system') {
        if (!withoutConditionals(composed).includes('{{system.unsubscribeUrl}}')) {
          throw new Error(
            `Non-system email template "${template.slug}" must include an unconditional unsubscribe link {{system.unsubscribeUrl}}.`,
          );
        }
      }

      if (options.lensFor) {
        for (const component of components)
          await validateDependents(component.slug, template.slug, ctx, options.lensFor);
      }

      return { template, components };
    },
    { timeout: 30_000 },
  );
};
