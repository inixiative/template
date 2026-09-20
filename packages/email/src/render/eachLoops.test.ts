import { describe, expect, it } from 'bun:test';
import { lensFor } from '@template/db/lens';
import { interpolate } from '@template/email/render/interpolate';
import type { RuleErrorSink } from '@template/email/render/settle';
import { emailLens } from '@template/email/rules/emailLens';
import { scopeEmailLens } from '@template/email/rules/scopeEmailLens';

const render = (template: string, data: Record<string, unknown>, onError?: RuleErrorSink) =>
  interpolate(template, { data }, onError);

describe('{{#each}} loops', () => {
  it('renders the body once per element bound to as=', () => {
    const out = render('{{#each data.items as=item}}<li>{{item.name}}</li>{{/each}}', {
      items: [{ name: 'A' }, { name: 'B' }],
    });
    expect(out).toBe('<li>A</li><li>B</li>');
  });

  it('binds a 0-based counter with index=', () => {
    const out = render('{{#each data.items as=item index=i}}{{i}}:{{item.name}} {{/each}}', {
      items: [{ name: 'A' }, { name: 'B' }],
    });
    expect(out).toBe('0:A 1:B ');
  });

  it('nests loops, inner scope sees enclosing bindings', () => {
    const out = render(
      '{{#each data.brands as=brand}}{{#each brand.missions as=mission}}[{{brand.name}}/{{mission.name}}]{{/each}}{{/each}}',
      { brands: [{ name: 'Acme', missions: [{ name: 'M1' }, { name: 'M2' }] }] },
    );
    expect(out).toBe('[Acme/M1][Acme/M2]');
  });

  it('filters elements with a json-rules predicate', () => {
    const out = render(
      '{{#each data.items as=item filter={"field":"item.active","operator":"equals","value":true}}}{{item.name}} {{/each}}',
      {
        items: [
          { name: 'A', active: true },
          { name: 'B', active: false },
          { name: 'C', active: true },
        ],
      },
    );
    expect(out).toBe('A C ');
  });

  it('a filter and a rule inside a loop see only what the lens admits', () => {
    const lens = scopeEmailLens(emailLens({ sender: lensFor('Organization') }), {
      ownerModel: 'Organization',
      ownerId: 'org-1',
    });
    const tag = (id: string, organizationId: string) => ({
      deletedAt: null,
      tag: { id, name: 'vip', ownerModel: 'Organization', organizationId },
    });
    const recipient = {
      id: 'u1',
      name: 'Ann',
      email: 'ann@example.com',
      tagAttachments: [tag('own', 'org-1'), tag('theirs', 'org-2')],
    };
    const filter = '{"field":"item.tag.name","operator":"equals","value":"vip"}';
    const rule = '{"field":"item.tag.name","operator":"equals","path":"recipient.name"}';
    const out = interpolate(
      `{{#each recipient.tagAttachments as=item filter=${filter}}}{{item.tag.id}} {{/each}}|{{#each recipient.tagAttachments as=item}}{{#if rule=${rule}}}{{item.tag.id}}{{/if}}{{/each}}`,
      { recipient: { ...recipient, name: 'vip' }, sender: { id: 'org-1', name: 'Acme' }, data: {} },
      undefined,
      { lens },
    );
    expect(out).toBe('own |own');
  });

  it('nested loops and path comparisons judge the element in scope, not another matching element', () => {
    const lens = emailLens({ sender: lensFor('Organization') });
    const member = (id: string) => ({ segment: { id, name: id } });
    const recipient = {
      id: 'u1',
      name: 'vip',
      email: 'ann@example.com',
      providerRefs: [{ segmentMembers: [member('s1'), member('s2')] }, { segmentMembers: [member('s3')] }],
      tagAttachments: [
        { deletedAt: null, tag: { id: 'match', name: 'vip' } },
        { deletedAt: null, tag: { id: 'other', name: 'plain' } },
      ],
    };
    const inner = '{"field":"member.segment.name","operator":"in","value":["s2","s3"]}';
    const toRoot = '{"field":"item.tag.name","operator":"equals","path":"recipient.name"}';
    const fromRoot = '{"field":"recipient.name","operator":"equals","path":"item.tag.name"}';
    const out = interpolate(
      `{{#each recipient.providerRefs as=ref}}{{#each ref.segmentMembers as=member}}{{#if rule=${inner}}}{{member.segment.id}} {{/if}}{{/each}}{{/each}}|{{#each recipient.tagAttachments as=item filter=${toRoot}}}{{item.tag.id}}{{/each}}|{{#each recipient.tagAttachments as=item filter=${fromRoot}}}{{item.tag.id}}{{/each}}`,
      { recipient, sender: { id: 'org-1', name: 'Acme' }, data: {} },
      undefined,
      { lens },
    );
    expect(out).toBe('s2 s3 |match|match');
  });

  it('a loop iterates only what the lens admits, so tokens and rules in the body agree', () => {
    const lens = emailLens({
      narrowing: {
        recipient: {
          picks: ['id', 'name'],
          relations: {
            tagAttachments: {
              picks: [],
              where: { field: 'deletedAt', operator: 'notExists' },
              relations: { tag: { picks: ['id', 'name'] } },
            },
          },
        },
      },
    });
    const out = interpolate(
      '{{#each recipient.tagAttachments as=item}}{{item.tag.id}} {{/each}}',
      {
        recipient: {
          id: 'u1',
          name: 'Ann',
          tagAttachments: [
            { deletedAt: null, tag: { id: 'live', name: 'a' } },
            { deletedAt: '2026-01-01', tag: { id: 'gone', name: 'b' } },
          ],
        },
        data: {},
      },
      undefined,
      { lens },
    );
    expect(out).toBe('live ');
  });

  it('an unsupported loop rule fails closed with an issue: nothing renders, no raw check', () => {
    const lens = scopeEmailLens(emailLens({ sender: lensFor('Organization') }), {
      ownerModel: 'Organization',
      ownerId: 'org-1',
    });
    const theirs = {
      deletedAt: null,
      tag: { id: 'theirs', name: 'vip', ownerModel: 'Organization', organizationId: 'org-2' },
    };
    const issues: string[] = [];
    const sink: RuleErrorSink = (issue) => issues.push(issue.detail);
    const compound =
      '{"all":[{"field":"item.tag.name","operator":"equals","value":"vip"},{"field":"sender.id","operator":"equals","value":"org-1"}]}';
    const out = interpolate(
      `{{#each recipient.tagAttachments as=item filter=${compound}}}{{item.tag.id}}{{/each}}|{{#each recipient.tagAttachments as=item index=i}}{{#if rule={"all":[{"field":"i","operator":"equals","value":0},{"field":"item.tag.name","operator":"equals","value":"vip"}]}}}{{item.tag.id}}{{/if}}{{/each}}`,
      {
        recipient: { id: 'u1', name: 'Ann', tagAttachments: [theirs] },
        sender: { id: 'org-1', name: 'Acme' },
        data: {},
      },
      sink,
      { lens },
    );
    expect(out).toBe('|');
    expect(issues.some((detail) => detail.includes('reads the sender lens from inside a loop over recipient'))).toBe(
      true,
    );
  });

  it('renders {{#if}} inside a loop against the element scope', () => {
    const out = render(
      '{{#each data.items as=item}}{{#if rule={"field":"item.vip","operator":"equals","value":true}}}★{{/if}}{{item.name}} {{/each}}',
      {
        items: [
          { name: 'A', vip: true },
          { name: 'B', vip: false },
        ],
      },
    );
    expect(out).toBe('★A B ');
  });

  it('renders nothing for an empty array', () => {
    expect(render('before{{#each data.items as=item}}{{item.name}}{{/each}}after', { items: [] })).toBe('beforeafter');
  });

  it('sinks and renders nothing when the path is not an array', () => {
    const errors: string[] = [];
    const out = render('{{#each data.missing as=item}}{{item.name}}{{/each}}', {}, (m) => errors.push(m.detail));
    expect(out).toBe('');
    expect(errors).toContain('{{#each data.missing}} did not resolve to an array');
  });

  it('renders a bare binding token empty (and sinks) when it resolves to an object', () => {
    const errors: string[] = [];
    const out = render('{{#each data.items as=item}}{{item}}{{/each}}', { items: [{ name: 'A' }] }, (m) =>
      errors.push(m.detail),
    );
    expect(out).toBe('');
    expect(errors.some((m) => m.includes('non-primitive'))).toBe(true);
  });

  it('rejects an as= that collides with a reserved root', () => {
    const errors: string[] = [];
    const out = render('{{#each data.items as=data}}x{{/each}}', { items: [{ name: 'A' }] }, (m) =>
      errors.push(m.detail),
    );
    expect(out).toBe('');
    expect(errors.some((m) => m.includes('collides'))).toBe(true);
  });

  it('rejects a missing as= attribute', () => {
    const errors: string[] = [];
    const out = render('{{#each data.items}}x{{/each}}', { items: [{ name: 'A' }] }, (m) => errors.push(m.detail));
    expect(out).toBe('');
    expect(errors.some((m) => m.includes('as='))).toBe(true);
  });

  it('renders an unknown root empty outside any loop, never the literal token', () => {
    expect(render('hello {{unknown.thing}} world', {})).toBe('hello  world');
  });
});
