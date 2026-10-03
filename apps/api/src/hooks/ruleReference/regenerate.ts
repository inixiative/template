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

const idsOf = (rows: Row[]): string[] =>
  rows.map((row) => row.id).filter((id): id is string => typeof id === 'string');

// Rebuild the revived owners' edges from the rules they hold now — every owner the revive brought
// back in one read per model, not one per row. Re-reads the owners rather than trusting the
// revive's result rows, whose columns are whatever the caller selected.
export const regenerateRuleReferences = async (model: string, rows: Row[]): Promise<void> => {
  const ids = idsOf(rows);
  if (!ids.length) return;

  switch (model) {
    case 'Segment': {
      const segments = await db.segment.findMany({ where: { id: { in: ids } } });
      for (const segment of segments)
        await regenerateRuleReferenceEdges(
          { model: 'Segment', id: segment.id },
          segment.conditions
            ? ruleReferences(customerRefLens, segment.conditions as Condition)
            : [],
        );
      return;
    }
    case 'EmailTemplate': {
      const templates = await db.emailTemplate.findMany({ where: { id: { in: ids } } });
      for (const template of templates) {
        const lens = emailLensFor(
          template.slug,
          rowOwner(template),
          await templateLens(template.slug, template),
        );
        await regenerateEmailRuleReferences(
          { model: 'EmailTemplate', id: template.id },
          templateRuleContents(template),
          lens,
        );
      }
      return;
    }
    case 'EmailComponent': {
      const components = await db.emailComponent.findMany({ where: { id: { in: ids } } });
      for (const component of components)
        await regenerateEmailRuleReferences(
          { model: 'EmailComponent', id: component.id },
          componentRuleContents(component),
          emailLensFor(undefined, rowOwner(component)),
        );
      return;
    }
  }
};
