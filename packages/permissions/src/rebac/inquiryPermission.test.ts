import { describe, expect, it } from 'bun:test';
import { InquiryType } from '@template/db/generated/client/enums';
import { inquiryPartyRule, inquiryPermission } from '@template/permissions/rebac/inquiryPermission';
import {
  INQUIRY_READ_LEVELS,
  INQUIRY_TYPES,
  type InquiryParty,
} from '@template/permissions/rebac/inquiryTypes';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { lowerFirst } from 'lodash-es';

type Gated = { any: { all: [{ rule: { operator: string; value: string } }, unknown] }[] };

describe('inquiryPermission', () => {
  it('declares parties for every inquiry type', () => {
    expect(Object.keys(INQUIRY_TYPES).sort()).toEqual(Object.values(InquiryType).sort());
  });

  it('names only actions the party model actually has', () => {
    const actionsOf = (model: string) =>
      Object.keys(rebacSchema.permissions[`db:${lowerFirst(model)}`]?.actions ?? {});
    const declared = [
      ...Object.values(INQUIRY_TYPES).flatMap(({ sources, targets }) =>
        [...sources, ...targets].flatMap((party) =>
          party.model === 'admin'
            ? []
            : [
                (party as InquiryParty & { send?: unknown }).send,
                (party as { resolve?: unknown }).resolve,
              ].flatMap((level) => (typeof level === 'string' ? [[party.model, level]] : [])),
        ),
      ),
      ...Object.entries(INQUIRY_READ_LEVELS),
    ] as [string, string][];

    for (const [model, action] of declared) expect(actionsOf(model)).toContain(action);
  });

  it('gates each grant on the party model and asks the relation named for its side and model', () => {
    expect(inquiryPartyRule('source', { model: 'Organization', send: 'own' }, 'send')).toEqual({
      all: [
        { rule: { field: 'sourceModel', operator: 'equals', value: 'Organization' } },
        { rel: 'sourceOrganization', action: 'own' },
      ],
    });
  });

  it('uses a level written as a rule exactly as written', () => {
    expect(
      inquiryPartyRule(
        'source',
        { model: 'Space', send: { rel: 'sourceSpace.organization', action: 'own' } },
        'send',
      ),
    ).toEqual({
      all: [
        { rule: { field: 'sourceModel', operator: 'equals', value: 'Space' } },
        { rel: 'sourceSpace.organization', action: 'own' },
      ],
    });
  });

  it('grants nothing for UserEvidence or for a verb the party does not declare', () => {
    expect(inquiryPartyRule('target', { model: 'admin' }, 'resolve')).toBeNull();
    expect(inquiryPartyRule('target', { model: 'User', resolve: 'manage' }, 'send')).toBeNull();
  });

  it('gates each send, resolve and read branch on its own type', () => {
    const { actions } = inquiryPermission(INQUIRY_TYPES);
    const gates = (rule: unknown) =>
      (rule as Gated).any.map(({ all: [gate] }) => [gate.rule.operator, gate.rule.value]);
    const expected = Object.keys(INQUIRY_TYPES).map((type) => ['equals', type]);

    expect(gates(actions.send)).toEqual(expected);
    expect(gates(actions.resolve)).toEqual(expected);
  });

  it('reads party-wide, whatever the type: the person on a side, or its organization or space with manage', () => {
    expect(inquiryPermission(INQUIRY_TYPES).actions.read).toEqual({
      any: [
        { rel: 'sourceUser', action: 'read' },
        { rel: 'sourceOrganization', action: 'manage' },
        { rel: 'sourceSpace', action: 'manage' },
        { rel: 'targetUser', action: 'read' },
        { rel: 'targetOrganization', action: 'manage' },
        { rel: 'targetSpace', action: 'manage' },
      ],
    });
  });

  it('is what the rebac schema serves for db:inquiry', () => {
    expect(rebacSchema.permissions['db:inquiry']).toEqual(inquiryPermission(INQUIRY_TYPES));
  });
});
