import { describe, expect, it } from 'bun:test';
import { checkRuleAgainstLens, createLens, type Lens } from '@inixiative/json-rules';
import { collectJsonOpacityWarnings } from '@template/email/rules/collectJsonOpacityWarnings';

const testLens: Lens = createLens({
  mapName: 'test',
  model: 'Root',
  maps: {
    test: {
      models: {
        Root: {
          fields: { recipient: { kind: 'object', type: 'Recipient' } },
        },
        Recipient: {
          fields: {
            firstName: { kind: 'scalar', type: 'String' },
            enrichments: { kind: 'object', type: 'Enrichment', isList: true },
            partners: { kind: 'bridge', type: 'test:Partner' },
          },
        },
        Enrichment: {
          fields: { valueMeta: { kind: 'scalar', type: 'Json' } },
        },
        Partner: {
          fields: { meta: { kind: 'scalar', type: 'Json' } },
        },
      },
    },
  },
});

describe('collectJsonOpacityWarnings', () => {
  it('confirms the hole: checkRuleAgainstLens does NOT catch a typo under a Json field', () => {
    const rule = { field: 'recipient.enrichments.valueMeta.tYpo', operator: 'notEmpty' } as const;
    expect(checkRuleAgainstLens(rule, testLens).ok).toBe(true);
  });

  it('warns when a collected path descends beneath a Json field', () => {
    const warnings = collectJsonOpacityWarnings(['recipient.enrichments.valueMeta.tYpo'], testLens);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('recipient.enrichments.valueMeta.tYpo');
  });

  it('does not warn for a path that stops AT the Json field (no sub-path)', () => {
    expect(collectJsonOpacityWarnings(['recipient.enrichments.valueMeta'], testLens)).toEqual([]);
  });

  it('does not warn for an ordinary scalar path', () => {
    expect(collectJsonOpacityWarnings(['recipient.firstName'], testLens)).toEqual([]);
  });

  it('warns for a Json column reached THROUGH a bridge relation (bridge hop is followed)', () => {
    const warnings = collectJsonOpacityWarnings(['recipient.partners.meta.tYpo'], testLens);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('recipient.partners.meta.tYpo');
  });

  it("does not warn for an unknown/unmodeled path (a different check's job)", () => {
    expect(collectJsonOpacityWarnings(['recipient.bogus.field'], testLens)).toEqual([]);
  });

  it('filters a mixed list down to only the paths that actually descend beneath a Json field', () => {
    const warnings = collectJsonOpacityWarnings(
      ['recipient.firstName', 'recipient.enrichments.valueMeta.tYpo', 'recipient.enrichments'],
      testLens,
    );
    expect(warnings).toHaveLength(1);
  });
});
