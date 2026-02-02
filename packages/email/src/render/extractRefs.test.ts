import { describe, it, expect } from 'bun:test';
import { mapRefs } from './extractRefs';

describe('mapRefs', () => {
  it('extracts a single component', () => {
    const input = `
      <mjml>
        {{#component:header}}
          <mj-section><mj-text>Hello</mj-text></mj-section>
        {{/component:header}}
      </mjml>
    `;

    const { map } = mapRefs(input);

    expect(Object.keys(map)).toEqual(['header']);
    expect(map['header']).toHaveLength(1);
    expect(map['header'][0].mjml).toBe('<mj-section><mj-text>Hello</mj-text></mj-section>');
    expect(map['header'][0].refs).toEqual([]);
  });

  it('extracts nested components', () => {
    const input = `
      {{#component:header}}
        <mj-section>
          {{#component:logo}}
            <mj-image src="logo.png" />
          {{/component:logo}}
        </mj-section>
      {{/component:header}}
    `;

    const { map } = mapRefs(input);

    expect(Object.keys(map).sort()).toEqual(['header', 'logo']);

    // Header has cleaned content with empty logo ref (tagged)
    expect(map['header'][0].mjml).toContain('{{#component:logo:0}}{{/component:logo:0}}');
    expect(map['header'][0].refs).toEqual(['logo:0']);

    // Logo has its actual content
    expect(map['logo'][0].mjml).toBe('<mj-image src="logo.png" />');
    expect(map['logo'][0].refs).toEqual([]);
  });

  it('extracts multiple instances of same slug with different content', () => {
    const input = `
      {{#component:button}}
        <mj-button>Click Me</mj-button>
      {{/component:button}}
      {{#component:button}}
        <mj-button>Submit</mj-button>
      {{/component:button}}
    `;

    const { map, mjml } = mapRefs(input);

    expect(map['button']).toHaveLength(2);
    expect(map['button'][0].mjml).toBe('<mj-button>Click Me</mj-button>');
    expect(map['button'][1].mjml).toBe('<mj-button>Submit</mj-button>');

    // Verify variant tags in output
    expect(mjml).toContain('{{#component:button:0}}');
    expect(mjml).toContain('{{/component:button:0}}');
    expect(mjml).toContain('{{#component:button:1}}');
    expect(mjml).toContain('{{/component:button:1}}');
  });

  it('deduplicates identical content for same slug', () => {
    const input = `
      {{#component:divider}}
        <mj-divider />
      {{/component:divider}}
      {{#component:divider}}
        <mj-divider />
      {{/component:divider}}
    `;

    const { map, mjml } = mapRefs(input);

    expect(map['divider']).toHaveLength(1);
    expect(map['divider'][0].mjml).toBe('<mj-divider />');

    // Both occurrences get :0 since content is identical
    const matches = mjml.match(/\{\{#component:divider:0\}\}/g);
    expect(matches).toHaveLength(2);
  });

  it('handles deeply nested components', () => {
    const input = `
      {{#component:outer}}
        <div>
          {{#component:middle}}
            <span>
              {{#component:inner}}
                <p>Deep</p>
              {{/component:inner}}
            </span>
          {{/component:middle}}
        </div>
      {{/component:outer}}
    `;

    const { map } = mapRefs(input);

    expect(Object.keys(map).sort()).toEqual(['inner', 'middle', 'outer']);

    // Outer refs middle (tagged)
    expect(map['outer'][0].refs).toEqual(['middle:0']);

    // Middle refs inner (tagged)
    expect(map['middle'][0].refs).toEqual(['inner:0']);

    // Inner has no refs
    expect(map['inner'][0].refs).toEqual([]);
    expect(map['inner'][0].mjml).toBe('<p>Deep</p>');
  });

  it('handles sibling components', () => {
    const input = `
      {{#component:header}}<header/>{{/component:header}}
      {{#component:content}}<main/>{{/component:content}}
      {{#component:footer}}<footer/>{{/component:footer}}
    `;

    const { map, mjml } = mapRefs(input);

    expect(Object.keys(map).sort()).toEqual(['content', 'footer', 'header']);
    expect(map['header'][0].mjml).toBe('<header/>');
    expect(map['content'][0].mjml).toBe('<main/>');
    expect(map['footer'][0].mjml).toBe('<footer/>');

    // All tagged :0
    expect(mjml).toContain('{{#component:header:0}}');
    expect(mjml).toContain('{{#component:content:0}}');
    expect(mjml).toContain('{{#component:footer:0}}');
  });

  it('handles same slug nested (two variants)', () => {
    const input = `
      {{#component:box}}
        {{#component:box}}
          <div>Inner</div>
        {{/component:box}}
      {{/component:box}}
    `;

    const { map, mjml } = mapRefs(input);

    // Two variants: inner has content, outer has ref to inner
    expect(map['box']).toHaveLength(2);
    expect(map['box'][0].mjml).toBe('<div>Inner</div>');
    expect(map['box'][1].refs).toEqual(['box:0']);

    expect(mjml).toContain('{{#component:box:0}}');
    expect(mjml).toContain('{{#component:box:1}}');
  });

  it('returns empty map for no components', () => {
    const input = '<mjml><mj-body><mj-text>No components</mj-text></mj-body></mjml>';
    const { map, mjml } = mapRefs(input);
    expect(map).toEqual({});
    expect(mjml).toBe(input);
  });

  it('handles empty component content', () => {
    const input = '{{#component:empty}}{{/component:empty}}';
    const { map, mjml } = mapRefs(input);

    expect(map['empty']).toHaveLength(1);
    expect(map['empty'][0].mjml).toBe('');
    expect(map['empty'][0].refs).toEqual([]);
    expect(mjml).toBe('{{#component:empty:0}}{{/component:empty:0}}');
  });

  it('handles component slugs with numbers and hyphens', () => {
    const input = `
      {{#component:header-v2}}
        <div>Version 2</div>
      {{/component:header-v2}}
      {{#component:cta-button-1}}
        <button>CTA</button>
      {{/component:cta-button-1}}
    `;

    const { map, mjml } = mapRefs(input);

    expect(Object.keys(map).sort()).toEqual(['cta-button-1', 'header-v2']);
    expect(mjml).toContain('{{#component:header-v2:0}}');
    expect(mjml).toContain('{{#component:cta-button-1:0}}');
  });
});

