import { describe, expect, it } from 'bun:test';
import { lensFor } from '@template/db/lens';
import {
  checkExpectations,
  collectUnprovidedPathWarnings,
  deriveComponentExpectations,
} from '@template/email/rules/componentExpectations';

describe('deriveComponentExpectations', () => {
  it('derives the absolute paths a component body demands, from tokens, rules and loops alike', () => {
    const mjml = [
      '<mj-text>{{recipient.firstName}}</mj-text>',
      '{{#if rule={"field":"recipient.pointsAmount","operator":"greaterThan","value":10}}}X{{/if}}',
      '{{#each recipient.contacts as=c}}{{c.label}}{{/each}}',
    ].join('\n');

    expect(deriveComponentExpectations(mjml)).toEqual([
      'recipient.contacts',
      'recipient.contacts.label',
      'recipient.firstName',
      'recipient.pointsAmount',
    ]);
  });

  it('excludes paths rooted at bindings the component does not open itself', () => {
    expect(deriveComponentExpectations('<mj-text>{{c.label}}</mj-text>')).toEqual([]);
  });
});

describe('checkExpectations (the "can this belong to this template" walk)', () => {
  const lens = lensFor('User');

  it('accepts paths that resolve against the lens, across scalars and through relations', () => {
    const checks = checkExpectations(['email', 'displayName', 'contacts.label'], lens);
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it('rejects paths the lens never exposed — including ones that merely resemble real fields', () => {
    const checks = checkExpectations(['notAColumn', 'contacts.notAField'], lens);
    expect(checks.map((check) => check.ok)).toEqual([false, false]);
  });

  it('accepts the open-ended tail beneath a Json column (covered by the opacity warning instead)', () => {
    expect(checkExpectations(['contacts.permissionRules.anything.below'], lens)[0]?.ok).toBe(true);
  });

  it('resolves system.* against the renderer token list, not the lens', () => {
    const checks = checkExpectations(['system.now', 'system.notAToken'], lens);
    expect(checks.map((check) => check.ok)).toEqual([true, false]);
  });

  it('treats {{system.unsubscribeUrl}} as rail-provided, and nothing else beyond the token list', () => {
    expect(checkExpectations(['system.unsubscribeUrl', 'system.notAToken'], lens)).toEqual([
      { path: 'system.unsubscribeUrl', ok: true },
      { path: 'system.notAToken', ok: false },
    ]);
  });
});

describe('collectUnprovidedPathWarnings (save-time token lint)', () => {
  it('phrases each unprovided path for the author and stays silent on provided ones', () => {
    const lens = lensFor('User');
    const warnings = collectUnprovidedPathWarnings(['email', 'notAColumn'], lens);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('{{notAColumn}}');
    expect(warnings[0]).toContain('literal text');
  });
});
