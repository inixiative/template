import { describe, expect, it } from 'bun:test';
import { InquiryType } from '@template/db/generated/client/enums';
import { inquiryPartyRule, inquiryPermission } from '@template/permissions/rebac/inquiryPermission';
import { INQUIRY_TYPES } from '@template/permissions/rebac/inquiryTypes';
import { rebacSchema } from '@template/permissions/rebac/schema';

type Gated = { any: { all: [{ rule: { operator: string; value: string } }, unknown] }[] };

describe('inquiryPermission', () => {
  it('declares parties for every inquiry type', () => {
    expect(Object.keys(INQUIRY_TYPES).sort()).toEqual(Object.values(InquiryType).sort());
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
