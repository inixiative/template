import { describe, expect, it } from 'bun:test';
import { interpolate } from '@template/email/render/interpolate';

describe('interpolate', () => {
  describe('variable substitution', () => {
    it('substitutes sender variables', () => {
      const result = interpolate('Hello from {{sender.name}}', {
        sender: { name: 'Acme Corp' },
      });
      expect(result).toBe('Hello from Acme Corp');
    });

    it('substitutes recipient variables', () => {
      const result = interpolate('Hi {{recipient.name}}, your email is {{recipient.email}}', {
        recipient: { name: 'John', email: 'john@example.com' },
      });
      expect(result).toBe('Hi John, your email is john@example.com');
    });

    it('substitutes data values', () => {
      const result = interpolate('Your code is {{data.code}}', {
        data: { code: '123456' },
      });
      expect(result).toBe('Your code is 123456');
    });

    it('substitutes system lens values', () => {
      const result = interpolate('Manage your prefs: {{system.preferencesUrl}}', {
        system: { preferencesUrl: 'https://app.example.com/prefs' },
      });
      expect(result).toBe('Manage your prefs: https://app.example.com/prefs');
    });

    it('resolves all four lenses together', () => {
      const result = interpolate('{{sender.name}}→{{recipient.name}}:{{data.code}} [{{system.appName}}]', {
        sender: { name: 'Acme' },
        recipient: { name: 'Jo' },
        data: { code: '42' },
        system: { appName: 'Tmpl' },
      });
      expect(result).toBe('Acme→Jo:42 [Tmpl]');
    });

    it('keeps placeholder if value not found', () => {
      const result = interpolate('Hello {{recipient.name}}', {});
      expect(result).toBe('Hello {{recipient.name}}');
    });

    it('escapes HTML in values', () => {
      const result = interpolate('Hello {{recipient.name}}', {
        recipient: { name: '<script>alert("xss")</script>' },
      });
      expect(result).toBe('Hello &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('handles multiple prefixes', () => {
      const result = interpolate('{{sender.name}} sent {{recipient.name}} code {{data.code}}', {
        sender: { name: 'Acme' },
        recipient: { name: 'John' },
        data: { code: '999' },
      });
      expect(result).toBe('Acme sent John code 999');
    });

    it('handles hyphenated keys', () => {
      const result = interpolate('Hi {{recipient.first-name}} {{recipient.last-name}}', {
        recipient: { 'first-name': 'John', 'last-name': 'Doe' },
      });
      expect(result).toBe('Hi John Doe');
    });

    it('resolves nested paths', () => {
      const result = interpolate('Org: {{data.org.name}}, role: {{data.member.role}}', {
        data: { org: { name: 'Acme' }, member: { role: 'admin' } },
      });
      expect(result).toBe('Org: Acme, role: admin');
    });

    it('does not resolve prototype-chain or inherited-function paths', () => {
      const template = '{{data.constructor.name}}|{{data.__proto__.x}}|{{data.prototype}}|{{data.toString}}';
      const result = interpolate(template, { data: {} });
      expect(result).toBe(template);
    });
  });

  describe('conditional blocks', () => {
    it('includes content when rule matches', () => {
      const result = interpolate(
        'Hello{{#if rule={"field":"recipient.role","operator":"equals","value":"admin"}}} Admin{{/if}}!',
        { recipient: { role: 'admin' } },
      );
      expect(result).toBe('Hello Admin!');
    });

    it('excludes content when rule does not match', () => {
      const result = interpolate(
        'Hello{{#if rule={"field":"recipient.role","operator":"equals","value":"admin"}}} Admin{{/if}}!',
        { recipient: { role: 'user' } },
      );
      expect(result).toBe('Hello!');
    });

    it('handles compound all rule', () => {
      const rule = JSON.stringify({
        all: [
          { field: 'recipient.role', operator: 'equals', value: 'admin' },
          { field: 'recipient.verified', operator: 'equals', value: true },
        ],
      });
      const result = interpolate(`Show{{#if rule=${rule}}} secret{{/if}} content`, {
        recipient: { role: 'admin', verified: true },
      });
      expect(result).toBe('Show secret content');
    });

    it('handles compound any rule', () => {
      const rule = JSON.stringify({
        any: [
          { field: 'recipient.role', operator: 'equals', value: 'admin' },
          { field: 'recipient.role', operator: 'equals', value: 'owner' },
        ],
      });
      const result = interpolate(`{{#if rule=${rule}}}Privileged{{/if}}`, {
        recipient: { role: 'owner' },
      });
      expect(result).toBe('Privileged');
    });

    it('substitutes variables after conditional evaluation', () => {
      const rule = JSON.stringify({ field: 'recipient.premium', operator: 'equals', value: true });
      const result = interpolate(`Hi {{recipient.name}}{{#if rule=${rule}}}, thanks for being premium{{/if}}!`, {
        recipient: { name: 'John', premium: true },
      });
      expect(result).toBe('Hi John, thanks for being premium!');
    });

    it('handles multiple conditionals', () => {
      const adminRule = JSON.stringify({ field: 'recipient.role', operator: 'equals', value: 'admin' });
      const premiumRule = JSON.stringify({ field: 'recipient.premium', operator: 'equals', value: true });

      const result = interpolate(
        `{{#if rule=${adminRule}}}[Admin]{{/if}}{{#if rule=${premiumRule}}}[Premium]{{/if}} User`,
        { recipient: { role: 'admin', premium: false } },
      );
      expect(result).toBe('[Admin] User');
    });

    it('handles in operator', () => {
      const rule = JSON.stringify({
        field: 'recipient.role',
        operator: 'in',
        value: ['admin', 'owner', 'manager'],
      });
      const result = interpolate(`{{#if rule=${rule}}}Manager View{{/if}}`, {
        recipient: { role: 'manager' },
      });
      expect(result).toBe('Manager View');
    });

    it('handles notEquals operator', () => {
      const rule = JSON.stringify({
        field: 'recipient.status',
        operator: 'notEquals',
        value: 'banned',
      });
      const result = interpolate(`{{#if rule=${rule}}}Welcome{{/if}}`, {
        recipient: { status: 'active' },
      });
      expect(result).toBe('Welcome');
    });

    it('handles braces inside string values', () => {
      const rule = JSON.stringify({
        field: 'recipient.msg',
        operator: 'equals',
        value: 'use {braces} here',
      });
      const result = interpolate(`{{#if rule=${rule}}}Matched{{/if}}`, {
        recipient: { msg: 'use {braces} here' },
      });
      expect(result).toBe('Matched');
    });

    it('drops a malformed-rule block by default and reports it via onError', () => {
      const errors: string[] = [];
      const result = interpolate('{{#if rule={invalid json}}}Content{{else}}Fallback{{/if}}', { recipient: {} }, (m) =>
        errors.push(m),
      );
      expect(result).toBe('Fallback');
      expect(errors).toHaveLength(1);
    });

    it('surfaces a malformed rule inline when EMAIL_INLINE_RENDER_ERRORS is set', () => {
      const prev = process.env.EMAIL_INLINE_RENDER_ERRORS;
      process.env.EMAIL_INLINE_RENDER_ERRORS = 'true';
      try {
        const result = interpolate('{{#if rule={invalid json}}}Content{{/if}}', { recipient: {} });
        expect(result).toContain('<!-- RULE ERROR:');
        expect(result).toContain('Content');
      } finally {
        if (prev === undefined) delete process.env.EMAIL_INLINE_RENDER_ERRORS;
        else process.env.EMAIL_INLINE_RENDER_ERRORS = prev;
      }
    });
  });
});
