/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses feature:email, feature:segment
 */
import { db } from '@template/db';
import { rowOwner, templateLens } from '@template/email/render';
import {
  componentRuleContents,
  syncRuleReferences,
  templateRuleContents,
} from '@template/email/rules';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { syncSegmentEdges } from '#/modules/segment/lib/syncSegmentEdges';

type Row = Record<string, unknown>;

const idsOf = (rows: Row[]): string[] =>
  rows.map((row) => row.id).filter((id): id is string => typeof id === 'string');

// Re-reads the sources rather than trusting the revive's result rows, whose columns are whatever the
// caller selected.
export const regenerateRuleReferences = async (model: string, rows: Row[]): Promise<void> => {
  const ids = idsOf(rows);
  if (!ids.length) return;

  switch (model) {
    case 'Segment': {
      const segments = await db.segment.findMany({ where: { id: { in: ids } } });
      for (const segment of segments) await syncSegmentEdges(segment, 'rebuild');
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
        await syncRuleReferences(
          { model: 'EmailTemplate', id: template.id },
          templateRuleContents(template),
          lens,
          'rebuild',
        );
      }
      return;
    }
    case 'EmailComponent': {
      const components = await db.emailComponent.findMany({ where: { id: { in: ids } } });
      for (const component of components)
        await syncRuleReferences(
          { model: 'EmailComponent', id: component.id },
          componentRuleContents(component),
          emailLensFor(undefined, rowOwner(component)),
          'rebuild',
        );
      return;
    }
  }
};
