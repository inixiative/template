import { describe, expect, it } from 'bun:test';
import { projectByPath } from '@inixiative/json-rules';
import {
  DEFAULT_RECIPIENT_LENS,
  EMAIL_RULE_MAP_NAME,
  emailLens,
  emailProjection,
  emailSurface,
  parseSlotLenses,
} from '@template/email/rules/emailProjection';
import { emailRuleDecoration } from '@template/email/rules/emailRuleDecoration';

const fieldsOf = (surface: ReturnType<typeof emailSurface>, model: string): string[] =>
  Object.keys(surface.maps[EMAIL_RULE_MAP_NAME]?.models[model]?.fields ?? {}).sort();

describe('emailProjection', () => {
  it('roots the projection at EmailRuleContext with a recipient and no sender or data by default', () => {
    const projection = emailProjection();
    expect(projection.model).toBe('EmailRuleContext');
    expect(fieldsOf(projection, 'EmailRuleContext')).toEqual(['recipient']);
  });

  it('carries the whole prisma map so the row lens can reach any relation', () => {
    const projection = emailProjection({ senderModel: 'Organization', data: { kind: 'model', model: 'Inquiry' } });
    expect(fieldsOf(projection, 'EmailRuleContext')).toEqual(['data', 'recipient', 'sender']);
    expect(fieldsOf(projection, 'Inquiry').length).toBeGreaterThan(3);
  });

  it('models a fields data projection as scalars on EmailData', () => {
    const projection = emailProjection({ data: { kind: 'fields', fields: { verificationUrl: 'String' } } });
    expect(fieldsOf(projection, 'EmailData')).toEqual(['verificationUrl']);
  });

  it('models a relations data projection as named relations on EmailData', () => {
    const projection = emailProjection({
      data: { kind: 'relations', relations: [{ name: 'inquiry', model: 'Inquiry' }] },
    });
    expect(fieldsOf(projection, 'EmailData')).toEqual(['inquiry']);
  });
});

describe('emailLens + emailSurface', () => {
  it('applies the engine default recipient lens when the row declares none', () => {
    const surface = emailSurface(emailProjection());
    expect(fieldsOf(surface, 'User')).toEqual([...DEFAULT_RECIPIENT_LENS.picks!].sort());
  });

  it('exposes exactly what the row lens reaches, and nothing beyond it', () => {
    const projection = emailProjection({ senderModel: 'Organization', data: { kind: 'model', model: 'Inquiry' } });
    const surface = emailSurface(projection, {
      recipient: { picks: ['email'], relations: { organizationUsers: { picks: ['role'] } } },
      sender: { picks: ['name'] },
      data: { picks: ['content'] },
    });
    expect(fieldsOf(surface, 'User')).toEqual(['email', 'organizationUsers']);
    expect(fieldsOf(surface, 'OrganizationUser')).toEqual(['role']);
    expect(fieldsOf(surface, 'Organization')).toEqual(['name']);
    expect(fieldsOf(surface, 'Inquiry')).toEqual(['content']);
    expect(surface.maps[EMAIL_RULE_MAP_NAME]?.models.Space).toBeUndefined();
  });

  it('defaults an unnarrowed sender and model data slot to their scalars', () => {
    const projection = emailProjection({ senderModel: 'Organization', data: { kind: 'model', model: 'Inquiry' } });
    const paths = [...projectByPath(emailLens(projection)).keys()];
    expect(paths).toContain('EmailRuleContext.sender');
    expect(paths).toContain('EmailRuleContext.data');
    expect(fieldsOf(emailSurface(projection), 'Organization')).not.toContain('emailTemplates');
  });

  it('defaults a relations data slot to each relation target scalars', () => {
    const projection = emailProjection({
      data: { kind: 'relations', relations: [{ name: 'inquiry', model: 'Inquiry' }] },
    });
    const surface = emailSurface(projection);
    expect(fieldsOf(surface, 'EmailData')).toEqual(['inquiry']);
    expect(fieldsOf(surface, 'Inquiry')).toContain('content');
  });

  it('rejects a row lens that names a field the projection does not have', () => {
    expect(() => emailLens(emailProjection(), { recipient: { picks: ['notAField'] } })).toThrow();
  });
});

describe('parseSlotLenses', () => {
  it('keeps only object-shaped slots', () => {
    expect(parseSlotLenses({ recipient: { picks: ['email'] }, sender: 'nope', data: null })).toEqual({
      recipient: { picks: ['email'] },
    });
    expect(parseSlotLenses(null)).toEqual({});
    expect(parseSlotLenses([1])).toEqual({});
  });
});

describe('emailRuleDecoration', () => {
  it('derives one facet per root relation', () => {
    const surface = emailSurface(emailProjection({ senderModel: 'Organization' }));
    expect(emailRuleDecoration(surface).facets).toEqual([
      { path: 'recipient', label: 'Recipient' },
      { path: 'sender', label: 'Sender' },
    ]);
  });
});
