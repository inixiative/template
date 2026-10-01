/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses feature:email, feature:segment
 */
import type { Condition } from '@inixiative/json-rules';
import { db, regenerateRuleReferenceEdges, ruleReferences } from '@template/db';
import { rowOwner, templateLens } from '@template/email/render';
import {
  componentRuleContents,
  regenerateRuleReferences as regenerateEmailRuleReferences,
  templateRuleContents,
} from '@template/email/rules';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { customerRefLens } from '#/modules/customerRef/lib/customerRefLens';

type Row = Record<string, unknown>;

// Rebuild a revived source's edges from the rule it holds now. Re-reads the source rather than
// trusting the revive's result row, whose columns are whatever the caller selected.
export const regenerateRuleReferences = async (model: string, row: Row): Promise<void> => {
  const id = row.id;
  if (typeof id !== 'string') return;

  switch (model) {
    case 'Segment': {
      const segment = await db.segment.findUnique({ where: { id } });
      if (!segment) return;
      await regenerateRuleReferenceEdges(
        { model: 'Segment', id },
        segment.conditions ? ruleReferences(customerRefLens, segment.conditions as Condition) : [],
      );
      return;
    }
    case 'EmailTemplate': {
      const template = await db.emailTemplate.findUnique({ where: { id } });
      if (!template) return;
      const lens = emailLensFor(
        template.slug,
        rowOwner(template),
        await templateLens(template.slug, template),
      );
      await regenerateEmailRuleReferences(
        { model: 'EmailTemplate', id },
        templateRuleContents(template),
        lens,
      );
      return;
    }
    case 'EmailComponent': {
      const component = await db.emailComponent.findUnique({ where: { id } });
      if (!component) return;
      await regenerateEmailRuleReferences(
        { model: 'EmailComponent', id },
        componentRuleContents(component),
        emailLensFor(undefined, rowOwner(component)),
      );
      return;
    }
  }
};
