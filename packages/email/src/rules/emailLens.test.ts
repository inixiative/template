import { describe, expect, it } from 'bun:test';
import { type Condition, check } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import {
  applyEmailLens,
  DEFAULT_RECIPIENT_NARROWING,
  EMAIL_SURFACE_ROOT,
  emailLens,
  emailRuleDecoration,
  emailRuleReferences,
  emailRuleVocabularyIssues,
  emailSurface,
  fieldsLens,
  OPAQUE_SLOT,
  parseSlotLenses,
  walkEmailLensPath,
} from '@template/email/rules/emailLens';
import { scopeEmailLens } from '@template/email/rules/scopeEmailLens';

const fieldsOf = (surface: ReturnType<typeof emailSurface>, model: string): string[] =>
  Object.keys(surface.maps[surface.mapName]?.models[model]?.fields ?? {}).sort();

const tagged = (id: string): Condition => ({
  field: 'recipient.tagAttachments',
  arrayOperator: 'any',
  condition: { field: 'tag.id', operator: 'equals', value: id },
});

const inSegment = (id: string): Condition => ({
  field: 'recipient.providerRefs',
  arrayOperator: 'any',
  condition: {
    field: 'segmentMembers',
    arrayOperator: 'any',
    condition: { field: 'segment.id', operator: 'equals', value: id },
  },
});

describe('emailLens — four lenses, one per scope root', () => {
  it('defaults to a User recipient, an opaque data bag and the system tokens, with no sender', () => {
    const lens = emailLens();
    expect(Object.keys(lens).sort()).toEqual(['data', 'recipient', 'system']);
    expect(lens.data).toBe(OPAQUE_SLOT);
    expect(lens.sender).toBeUndefined();
  });

  it('the default recipient reaches tags, spaces, organizations and segment membership', () => {
    const lens = emailLens();
    for (const path of [
      'recipient.tagAttachments.tag.id',
      'recipient.spaceUsers.space.name',
      'recipient.organizationUsers.organization.id',
      'recipient.providerRefs.segmentMembers.segment.id',
    ]) {
      expect(walkEmailLensPath(path, lens).outcome).toBe('resolved');
    }
  });

  it('walks a path into the slot its root names', () => {
    const lens = emailLens({ sender: lensFor('Organization'), data: lensFor('Inquiry') });
    expect(walkEmailLensPath('recipient.name', lens)).toEqual({ outcome: 'resolved' });
    expect(walkEmailLensPath('recipient.nope', lens)).toEqual({ outcome: 'missing', index: 1 });
    expect(walkEmailLensPath('sender.name', lens)).toEqual({ outcome: 'resolved' });
    expect(walkEmailLensPath('data.content', lens)).toEqual({ outcome: 'resolved' });
    expect(walkEmailLensPath('system.now', lens)).toEqual({ outcome: 'resolved' });
    expect(walkEmailLensPath('system.nope', lens)).toEqual({ outcome: 'missing', index: 1 });
    expect(walkEmailLensPath('nope.x', lens)).toEqual({ outcome: 'missing', index: 0 });
    expect(walkEmailLensPath('sender.name', emailLens())).toEqual({ outcome: 'missing', index: 0 });
  });

  it('an opaque data bag is addressable at any depth, as beneath-Json rather than missing', () => {
    expect(walkEmailLensPath('data.mission.reward.amount', emailLens()).outcome).toBe('beneathJson');
    expect(
      emailRuleVocabularyIssues(emailLens(), {
        field: 'data.mission.reward.amount',
        operator: 'greaterThan',
        value: 1,
      }),
    ).toEqual([]);
  });

  it('a stored slot replaces the engine default for that slot only', () => {
    const lens = emailLens({
      sender: lensFor('Organization'),
      data: lensFor('Inquiry'),
      narrowing: {
        recipient: { picks: ['email'], relations: { organizationUsers: { picks: ['role'] } } },
        data: { picks: ['content'] },
      },
    });
    expect(walkEmailLensPath('recipient.tagAttachments.tag.id', lens).outcome).toBe('missing');
    expect(walkEmailLensPath('recipient.organizationUsers.role', lens).outcome).toBe('resolved');
    expect(walkEmailLensPath('data.content', lens).outcome).toBe('resolved');
    expect(walkEmailLensPath('data.id', lens).outcome).toBe('missing');
    expect(walkEmailLensPath('sender.name', lens).outcome).toBe('resolved');
  });

  it('a declared-fields data lens exposes exactly its fields', () => {
    const fields = emailLens({ data: fieldsLens({ verificationUrl: 'String' }) });
    expect(walkEmailLensPath('data.verificationUrl', fields).outcome).toBe('resolved');
    expect(walkEmailLensPath('data.other', fields).outcome).toBe('missing');
  });

  it('rejects a stored slot that names a field its model does not have', () => {
    expect(() => emailLens({ narrowing: { recipient: { picks: ['notAField'] } } })).toThrow();
  });
});

describe('emailLens — the rule vocabulary', () => {
  const lens = emailLens({ sender: lensFor('Organization') });

  it('the canonical membership spellings are clean', () => {
    expect(emailRuleVocabularyIssues(lens, tagged('tag-a'))).toEqual([]);
    expect(emailRuleVocabularyIssues(lens, inSegment('seg-a'))).toEqual([]);
  });

  it('an FK-column spelling of a reference is refused — omitForeignKeys drops the column', () => {
    expect(
      emailRuleVocabularyIssues(lens, {
        field: 'recipient.tagAttachments',
        arrayOperator: 'any',
        condition: { field: 'tagId', operator: 'equals', value: 'tag-a' },
      }).length,
    ).toBeGreaterThan(0);
  });

  it('a relation the slot does not declare, a typo path and an unknown root are refused', () => {
    const issues = emailRuleVocabularyIssues(lens, {
      all: [
        { field: 'recipient.tags', arrayOperator: 'any', condition: { field: 'id', operator: 'equals', value: 'x' } },
        { field: 'recipient.zzzNope', operator: 'equals', value: 'x' },
        { field: 'nope.field', operator: 'equals', value: 'x' },
      ],
    });
    expect(issues).toHaveLength(3);
    expect(issues[2]).toContain('nope');
  });

  it('a comparison across two slots resolves the path in the other slot', () => {
    const across: Condition = {
      field: 'recipient.organizationUsers',
      arrayOperator: 'any',
      condition: { field: 'organization.id', operator: 'equals', path: 'sender.id' },
    };
    expect(emailRuleVocabularyIssues(lens, across)).toEqual([]);
    expect(emailRuleVocabularyIssues(emailLens(), across).length).toBeGreaterThan(0);
  });
});

describe('emailLens — the rows a rule names', () => {
  const lens = emailLens({ sender: lensFor('Organization') });

  it('membership over tags and segments names each row', () => {
    expect(emailRuleReferences(lens, { any: [tagged('tag-a'), inSegment('seg-a')] })).toEqual([
      { model: 'Tag', id: 'tag-a' },
      { model: 'Segment', id: 'seg-a' },
    ]);
  });

  it('dotted spellings reach the same sources', () => {
    expect(
      emailRuleReferences(lens, {
        any: [
          { field: 'recipient.spaceUsers.space.id', operator: 'equals', value: 'space-1' },
          { field: 'recipient.organizationUsers.organization.id', operator: 'notEquals', value: 'org-1' },
        ],
      }),
    ).toEqual([
      { model: 'Space', id: 'space-1' },
      { model: 'Organization', id: 'org-1' },
    ]);
  });

  it('the sender names its own row, as any slot reaching a referenceable id does', () => {
    expect(emailRuleReferences(lens, { field: 'sender.id', operator: 'equals', value: 'org-1' })).toEqual([
      { model: 'Organization', id: 'org-1' },
    ]);
  });

  it('vocabulary values, plain fields, the data bag, path and bind leaves name nothing', () => {
    expect(
      emailRuleReferences(lens, {
        all: [
          { field: 'recipient.tagAttachments.tag.name', operator: 'equals', value: 'vip' },
          { field: 'recipient.name', operator: 'equals', value: 'tag-a' },
          { field: 'data.tagId', operator: 'equals', value: 'tag-a' },
          { field: 'recipient.tagAttachments.tag.id', operator: 'equals', path: 'data.tagId' },
          { field: 'recipient.tagAttachments.tag.id', operator: 'equals', bind: 'tagId' },
        ],
      }),
    ).toEqual([]);
  });
});

describe('emailLens — evaluation goes through the lens', () => {
  const org = { ownerModel: 'Organization' as const, ownerId: 'org-1' };
  const scope = (tagOwner: Record<string, unknown>, segmentOwner: Record<string, unknown>) => ({
    recipient: {
      id: 'u1',
      name: 'Ann',
      tagAttachments: [{ deletedAt: null, tag: { id: 'tag-a', name: 'vip', ...tagOwner } }],
      providerRefs: [{ segmentMembers: [{ segment: { id: 'seg-a', name: 's', deletedAt: null, ...segmentOwner } }] }],
    },
    sender: { id: 'org-1', name: 'Acme' },
    data: {},
  });

  it('a tag or segment outside the owner view does not match; inside it does', () => {
    const lens = scopeEmailLens(emailLens({ sender: lensFor('Organization') }), org);
    const own = scope(
      { ownerModel: 'Organization', organizationId: 'org-1' },
      { ownerModel: 'Organization', organizationId: 'org-1' },
    );
    const other = scope(
      { ownerModel: 'Organization', organizationId: 'org-2' },
      { ownerModel: 'Organization', organizationId: 'org-2' },
    );
    const platform = scope(
      { ownerModel: 'platform', organizationId: null },
      { ownerModel: 'Organization', organizationId: 'org-2' },
    );

    expect(check(applyEmailLens(lens, tagged('tag-a')), own)).toBe(true);
    expect(check(applyEmailLens(lens, inSegment('seg-a')), own)).toBe(true);
    expect(check(applyEmailLens(lens, tagged('tag-a')), other)).not.toBe(true);
    expect(check(applyEmailLens(lens, inSegment('seg-a')), other)).not.toBe(true);
    expect(check(applyEmailLens(lens, tagged('tag-a')), platform)).toBe(true);
  });

  it('a platform owner sees platform tags and no segments', () => {
    const lens = scopeEmailLens(emailLens(), null);
    const own = scope(
      { ownerModel: 'platform', organizationId: null },
      { ownerModel: 'Organization', organizationId: 'org-1' },
    );
    expect(check(applyEmailLens(lens, tagged('tag-a')), own)).toBe(true);
    expect(check(applyEmailLens(lens, inSegment('seg-a')), own)).not.toBe(true);
  });

  it('prefixes what the slot folded in back onto the root, and leaves paths and foreign roots alone', () => {
    const lens = emailLens({ sender: lensFor('Organization') });
    const applied = applyEmailLens(lens, {
      all: [
        { field: 'recipient.name', operator: 'equals', value: 'Ann' },
        {
          field: 'recipient.organizationUsers',
          arrayOperator: 'any',
          condition: { field: 'organization.id', operator: 'equals', path: 'sender.id' },
        },
        { field: 'item.price', operator: 'greaterThan', value: 1 },
      ],
    });
    expect(JSON.stringify(applied)).toContain('"field":"recipient.name"');
    expect(JSON.stringify(applied)).toContain('"path":"sender.id"');
    expect(JSON.stringify(applied)).toContain('"field":"item.price"');
    const data = {
      ...scope({}, {}),
      recipient: { ...scope({}, {}).recipient, organizationUsers: [{ organization: { id: 'org-1' } }] },
      item: { price: 2 },
    };
    expect(check(applied, data)).toBe(true);
  });
});

describe('emailSurface — the four lenses composed for the builder', () => {
  it('roots the surface at Email with one field per slot and the union of what each slot exposes', () => {
    const surface = emailSurface(emailLens({ sender: lensFor('Organization') }));
    expect(surface.model).toBe(EMAIL_SURFACE_ROOT);
    expect(fieldsOf(surface, EMAIL_SURFACE_ROOT)).toEqual(['data', 'recipient', 'sender', 'system']);
    expect(surface.maps[surface.mapName]?.models[EMAIL_SURFACE_ROOT]?.fields.data).toEqual({
      kind: 'scalar',
      type: 'Json',
    });
    expect(fieldsOf(surface, 'User')).toEqual(
      [...DEFAULT_RECIPIENT_NARROWING.picks!, ...Object.keys(DEFAULT_RECIPIENT_NARROWING.relations!)].sort(),
    );
    expect(fieldsOf(surface, 'Organization')).not.toContain('emailTemplates');
    expect(fieldsOf(surface, 'EmailSystem')).toEqual(['now', 'unsubscribeUrl', 'year']);
  });

  it('exposes exactly what the slots reach, and nothing beyond it', () => {
    const surface = emailSurface(
      emailLens({
        sender: lensFor('Organization'),
        data: lensFor('Inquiry'),
        narrowing: {
          recipient: { picks: ['email'], relations: { organizationUsers: { picks: ['role'] } } },
          sender: { picks: ['name'] },
          data: { picks: ['content'] },
        },
      }),
    );
    expect(fieldsOf(surface, 'User')).toEqual(['email', 'organizationUsers']);
    expect(fieldsOf(surface, 'OrganizationUser')).toEqual(['role']);
    expect(fieldsOf(surface, 'Organization')).toEqual(['name']);
    expect(fieldsOf(surface, 'Inquiry')).toEqual(['content']);
    expect(surface.maps[surface.mapName]?.models.Space).toBeUndefined();
  });

  it('derives one facet per slot present', () => {
    expect(emailRuleDecoration(emailLens({ sender: lensFor('Organization') })).facets).toEqual([
      { path: 'sender', label: 'Sender' },
      { path: 'recipient', label: 'Recipient' },
      { path: 'data', label: 'Data' },
      { path: 'system', label: 'System' },
    ]);
    expect(emailRuleDecoration(emailLens()).facets.map((facet) => facet.path)).toEqual(['recipient', 'data', 'system']);
  });
});

describe('parseSlotLenses', () => {
  it('keeps only object-shaped slots', () => {
    expect(parseSlotLenses({ recipient: { picks: ['email'] }, sender: 'nope', data: null })).toEqual({
      recipient: { picks: ['email'] },
    });
    expect(parseSlotLenses({ data: { picks: ['content'] }, extra: 1 })).toEqual({ data: { picks: ['content'] } });
    expect(parseSlotLenses(null)).toEqual({});
    expect(parseSlotLenses([1])).toEqual({});
  });
});
