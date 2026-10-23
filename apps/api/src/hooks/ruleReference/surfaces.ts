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
  templateRuleContents,
} from '@template/email/rules';
import type { RuleLens, RuleReference } from '@template/shared/rules';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { resolvedCustomerRefLens } from '#/modules/customerRef/lib/customerRefLens';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

type Row = Record<string, unknown>;

export type RuleReferenceReading = {
  references: RuleReference[];
  scopes: ReferenceScope[];
  dynamic: DynamicRuleReference[];
};

type RuleColumnStorage<Lens> = (row: Row, lens: Lens) => RuleReferenceReading;

type RuleReferenceDeclaration<Lens> = {
  columns: readonly string[];
  label: (row: Row) => string;
  lens: (row: Row) => Lens | Promise<Lens>;
  storage: RuleColumnStorage<Lens>;
};

export type RuleReferenceSurface = Pick<RuleReferenceDeclaration<unknown>, 'columns' | 'label'> & {
  read: (row: Row) => Promise<RuleReferenceReading>;
};

const storedAsMjml =
  (contents: (row: Row) => string[]): RuleColumnStorage<EmailLens> =>
  (row, lens) => {
    const stored = contents(row);
    return {
      references: contentRuleReferences(lens, ...stored),
      scopes: contentReferenceScopes(lens, ...stored),
      dynamic: contentDynamicRuleReferences(lens, ...stored),
    };
  };

const storedAsCondition: RuleColumnStorage<RuleLens> = (row, lens) => {
  const tree = row.conditions as Condition | null | undefined;
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
  read: async (row) => declaration.storage(row, await declaration.lens(row)),
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
    storage: storedAsMjml((row) => templateRuleContents(row as EmailTemplate)),
  }),
  EmailComponent: declare({
    columns: ['mjml'],
    label: (row) => `email component '${row.slug}'`,
    lens: (row) => emailLensFor(undefined, rowOwner(row as EmailComponent)),
    storage: storedAsMjml((row) => componentRuleContents(row as EmailComponent)),
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
