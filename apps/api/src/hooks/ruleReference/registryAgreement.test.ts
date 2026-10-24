import { describe, expect, test } from 'bun:test';
import { projectLens } from '@inixiative/json-rules';
import { getPolymorphismConfig, RULE_REFERENCEABLE_MODELS } from '@template/db';
import type { EmailOwnerModel } from '@template/db/generated/client/enums';
import { RuleReferenceTargetModel } from '@template/db/generated/client/enums';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { EmailOwnerRef } from '@template/email/render';
import { emailSlotLenses } from '@template/email/rules';
import type { RuleLens } from '@template/shared/rules';
import type { RULE_REFERENCE_SURFACES } from '#/hooks/ruleReference/surfaces';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { registry } from '#/lib/email/registry';
import { customerRefLens } from '#/modules/customerRef/lib/customerRefLens';

type IdFields = Record<string, { fields: Record<string, { isId?: boolean }> }>;

const ORG = '00000000-0000-7000-8000-000000000001';
const SPACE = '00000000-0000-7000-8000-000000000002';
const USER = '00000000-0000-7000-8000-000000000003';

const EMAIL_OWNERS: EmailOwnerRef[] = (
  ['default', 'admin', 'Organization', 'Space', 'User'] satisfies EmailOwnerModel[]
).map((ownerModel) => ({ ownerModel, organizationId: ORG, spaceId: SPACE, userId: USER }));

const emailLenses = (slugs: (string | undefined)[]): RuleLens[] =>
  slugs.flatMap((slug) =>
    EMAIL_OWNERS.flatMap((owner) =>
      emailSlotLenses(emailLensFor(slug, owner)).map(([, slot]) => slot),
    ),
  );

const AUTHORED_UNDER = {
  EmailTemplate: emailLenses(Object.keys(registry)),
  EmailComponent: emailLenses([undefined]),
  Segment: [customerRefLens],
} satisfies Record<keyof typeof RULE_REFERENCE_SURFACES, RuleLens[]>;

const idSourceModels = (lens: RuleLens): Set<string> => {
  const models = new Set<string>();
  for (const visit of Object.values(projectLens(lens)))
    for (const field of Object.keys(visit.sources))
      if (
        visit.fields[field] &&
        (prismaMap.models as unknown as IdFields)[visit.model]?.fields[field]?.isId
      )
        models.add(visit.model);
  return models;
};

const referenceableModels = (source: keyof typeof AUTHORED_UNDER): Set<string> =>
  new Set(AUTHORED_UNDER[source].flatMap((lens) => [...idSourceModels(lens)]));

describe('lens and registry agree on what a rule can reference', () => {
  const registered = new Set<string>(RULE_REFERENCEABLE_MODELS);

  for (const source of Object.keys(AUTHORED_UNDER) as (keyof typeof AUTHORED_UNDER)[]) {
    test(`every model a ${source} rule can name by id has a target column`, () => {
      expect([...referenceableModels(source)].filter((model) => !registered.has(model))).toEqual(
        [],
      );
    });
  }

  test('every target column is referenceable under some lens', () => {
    const reachable = new Set(
      (Object.keys(AUTHORED_UNDER) as (keyof typeof AUTHORED_UNDER)[]).flatMap((source) => [
        ...referenceableModels(source),
      ]),
    );
    expect([...registered].filter((model) => !reachable.has(model))).toEqual([]);
  });

  test('the targetModel enum and the registry carry the same models, one column each', () => {
    const targetAxis = getPolymorphismConfig('RuleReference')?.axes.find(
      (axis) => axis.field === 'targetModel',
    );
    expect(Object.keys(targetAxis?.fkMap ?? {}).sort()).toEqual(
      Object.values(RuleReferenceTargetModel).sort(),
    );
    for (const [model, columns] of Object.entries(targetAxis?.fkMap ?? {}))
      expect({ model, count: columns.length }).toEqual({ model, count: 1 });
  });
});
