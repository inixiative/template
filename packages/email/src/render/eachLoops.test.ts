import { describe, expect, it } from 'bun:test';
import { interpolate } from '@template/email/render/interpolate';

const render = (template: string, data: Record<string, unknown>, onError?: (m: string) => void) =>
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
    const out = render('{{#each data.missing as=item}}{{item.name}}{{/each}}', {}, (m) => errors.push(m));
    expect(out).toBe('');
    expect(errors).toContain('{{#each data.missing}} did not resolve to an array');
  });

  it('leaves a bare binding token visible (and sinks) when it resolves to an object', () => {
    const errors: string[] = [];
    const out = render('{{#each data.items as=item}}{{item}}{{/each}}', { items: [{ name: 'A' }] }, (m) =>
      errors.push(m),
    );
    expect(out).toBe('{{item}}');
    expect(errors.some((m) => m.includes('non-primitive'))).toBe(true);
  });

  it('rejects an as= that collides with a reserved root', () => {
    const errors: string[] = [];
    const out = render('{{#each data.items as=data}}x{{/each}}', { items: [{ name: 'A' }] }, (m) => errors.push(m));
    expect(out).toBe('');
    expect(errors.some((m) => m.includes('collides'))).toBe(true);
  });

  it('rejects a missing as= attribute', () => {
    const errors: string[] = [];
    const out = render('{{#each data.items}}x{{/each}}', { items: [{ name: 'A' }] }, (m) => errors.push(m));
    expect(out).toBe('');
    expect(errors.some((m) => m.includes('as='))).toBe(true);
  });

  it('leaves loop-free binding-shaped text byte-identical', () => {
    expect(render('hello {{unknown.thing}} world', {})).toBe('hello {{unknown.thing}} world');
  });
});
