/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses feature:email, feature:segment, primitive:shared
 */
import type { Condition } from '@inixiative/json-rules';
import {
  type DynamicRuleReference,
  dynamicRuleReferences,
  type ReferenceScope,
  ruleReferences,
} from '@template/db';
import type { EmailComponent, EmailTemplate, Segment } from '@template/db/generated/client/client';
import type { RuleReferenceSourceModel } from '@template/db/generated/client/enums';
import { rowOwner, templateLens } from '@template/email/render';
import {
  componentRuleContents,
  contentDynamicRuleReferences,
  contentReferenceScopes,
  contentRuleReferences,
  type EmailLens,
  type RuleContents,
  templateRuleContents,
} from '@template/email/rules';
import type { RuleLens, RuleReference } from '@template/shared/rules';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { resolvedCustomerRefLens } from '#/modules/customerRef/lib/resolvedCustomerRefLens';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

type Row = Record<string, unknown>;

export type RuleReferenceReading = {
  references: RuleReference[];
  scopes: ReferenceScope[];
  dynamic: DynamicRuleReference[];
};

type RuleColumnStorage<Lens> = (
  row: Row,
  lens: Lens,
  columns: readonly string[],
) => RuleReferenceReading;

type RuleReferenceDeclaration<Lens> = {
  columns: readonly string[];
  label: (row: Row) => string;
  lens: (row: Row) => Lens | Promise<Lens>;
  storage: RuleColumnStorage<Lens>;
};

export type RuleReferenceSurface = Pick<RuleReferenceDeclaration<unknown>, 'columns' | 'label'> & {
  read: (
    row: Row,
    judged: readonly string[],
  ) => Promise<{ references: RuleReference[]; judged: RuleReferenceReading }>;
};

const storedAsMjml =
  (contents: RuleContents<never>): RuleColumnStorage<EmailLens> =>
  (row, lens, columns) => {
    const stored = columns.flatMap((column) => contents[column]?.(row as never) ?? []);
    return {
      references: contentRuleReferences(lens, ...stored),
      scopes: contentReferenceScopes(lens, ...stored),
      dynamic: contentDynamicRuleReferences(lens, ...stored),
    };
  };

const storedAsCondition: RuleColumnStorage<RuleLens> = (row, lens, columns) => {
  const tree = columns.includes('conditions')
    ? (row.conditions as Condition | null | undefined)
    : undefined;
  const references = tree ? ruleReferences(lens, tree) : [];
  return {
    references,
    scopes: [{ lens, references }],
    dynamic: tree ? dynamicRuleReferences(lens, tree) : [],
  };
};

const declare = <Lens>(declaration: RuleReferenceDeclaration<Lens>): RuleReferenceSurface => ({
  columns: declaration.columns,
  label: declaration.label,
  read: async (row, judged) => {
    const lens = await declaration.lens(row);
    return {
      references: declaration.storage(row, lens, declaration.columns).references,
      judged: declaration.storage(row, lens, judged),
    };
  },
});

export const RULE_REFERENCE_SURFACES: Record<RuleReferenceSourceModel, RuleReferenceSurface> = {
  EmailTemplate: declare({
    columns: ['subject', 'mjml'],
    label: (row) => `email template '${row.slug}'`,
    lens: async (row) => {
      const template = row as EmailTemplate;
      return emailLensFor(
        template.slug,
        rowOwner(template),
        await templateLens(template.slug, template),
      );
    },
    storage: storedAsMjml(templateRuleContents),
  }),
  EmailComponent: declare({
    columns: ['mjml'],
    label: (row) => `email component '${row.slug}'`,
    lens: (row) => emailLensFor(undefined, rowOwner(row as EmailComponent)),
    storage: storedAsMjml(componentRuleContents),
  }),
  Segment: declare({
    columns: ['conditions'],
    label: (row) => `segment '${row.name ?? row.id}'`,
    lens: (row) =>
      resolvedCustomerRefLens((row as Segment).ownerModel, segmentOwnerId(row as Segment)),
    storage: storedAsCondition,
  }),
};

export const isRuleReferenceSourceModel = (model: string): model is RuleReferenceSourceModel =>
  model in RULE_REFERENCE_SURFACES;
