/**
 * @atlas
 * @kind test
 * @partOf feature:email
 * @uses none
 */
import { describe, expect, test } from 'bun:test';
import { decompose } from '@template/email/render/decompose';
import { ParseBlocksError } from '@template/email/render/parseBlocks';
import {
  collapseComponentBodies,
  collectComponentRegions,
  removeSlotOverride,
  slotDefaultContent,
} from '@template/email/render/regions';

describe('collectComponentRegions', () => {
  test('bare ref → one region, no body, no overrides', () => {
    const regions = collectComponentRegions('a{{#component:footer}}{{/component:footer}}b');
    expect(regions).toEqual([
      { slug: 'footer', path: [1], depth: 0, hasBody: false, overrideSlots: [], occurrenceIndex: 0 },
    ]);
  });

  test('ref with only an override slot → no body, override listed (per-instance overridden state)', () => {
    const src = '{{#component:card}}{{#slot:header}}<mj-text>Hi</mj-text>{{/slot:header}}{{/component:card}}';
    expect(collectComponentRegions(src)).toMatchObject([{ hasBody: false, overrideSlots: ['header'] }]);
  });

  test('inlined body (chrome + :default slot) → hasBody, nested ref gets its own deeper region', () => {
    const src =
      '{{#component:card}}<mj-section>{{#slot:x:default}}{{#component:cta}}{{/component:cta}}{{/slot:x:default}}</mj-section>{{/component:card}}';
    const regions = collectComponentRegions(src);
    expect(regions).toEqual([
      { slug: 'card', path: [0], depth: 0, hasBody: true, overrideSlots: [], occurrenceIndex: 0 },
      { slug: 'cta', path: [0, 1, 0], depth: 1, hasBody: false, overrideSlots: [], occurrenceIndex: 0 },
    ]);
  });

  test('whitespace between tags counts as body — the exact split decompose diffs', () => {
    const src = '{{#component:card}}\n  {{#slot:h}}x{{/slot:h}}\n{{/component:card}}';
    expect(collectComponentRegions(src)).toMatchObject([{ hasBody: true, overrideSlots: ['h'] }]);
  });

  test('a :default subtree superseded by a sibling override is inherited-but-hidden — not listed', () => {
    const src =
      '{{#component:card}}{{#slot:body:default}}{{#component:hidden}}{{/component:hidden}}{{/slot:body:default}}' +
      '{{#slot:body}}{{#component:shown}}{{/component:shown}}{{/slot:body}}{{/component:card}}';
    const slugs = collectComponentRegions(src).map((region) => region.slug);
    expect(slugs).toEqual(['card', 'shown']);
  });

  test('two occurrences of one slug → two regions with distinct paths and occurrence ranks', () => {
    const src = '{{#component:a}}{{/component:a}}{{#component:a}}{{/component:a}}';
    const regions = collectComponentRegions(src);
    expect(regions.map((region) => region.path)).toEqual([[0], [1]]);
    expect(regions.map((region) => region.occurrenceIndex)).toEqual([0, 1]);
  });

  test('malformed source throws ParseBlocksError (editor catches and degrades mid-keystroke)', () => {
    expect(() => collectComponentRegions('{{#component:a}}')).toThrow(ParseBlocksError);
  });
});

describe('collapseComponentBodies (revert local edits → bare refs, save-time noop)', () => {
  test('strips the body, keeps caller overrides, round-trips every other byte', () => {
    const src =
      'before {{#component:card}}<mj-section>edited</mj-section>' +
      '{{#slot:header}}<mj-text>Hi</mj-text>{{/slot:header}}{{/component:card}} after';
    expect(collapseComponentBodies(src, 'card')).toBe(
      'before {{#component:card}}{{#slot:header}}<mj-text>Hi</mj-text>{{/slot:header}}{{/component:card}} after',
    );
  });

  test('collapsed ref is a save-time noop — decompose emits no write for the slug', () => {
    const cascade = '<mj-section>original</mj-section>';
    const src = '{{#component:card}}<mj-section>edited</mj-section>{{/component:card}}';
    const reverted = collapseComponentBodies(src, 'card');
    const { writes } = decompose(reverted, (slug) => (slug === 'card' ? cascade : undefined));
    expect(writes).toEqual([]);
  });

  test('collapses EVERY occurrence of the slug — a lone collapse would manufacture a divergent duplicate', () => {
    const src = '{{#component:h}}<e/>{{/component:h}}mid{{#component:h}}<e/>{{/component:h}}';
    expect(collapseComponentBodies(src, 'h')).toBe(
      '{{#component:h}}{{/component:h}}mid{{#component:h}}{{/component:h}}',
    );
  });

  test('nested occurrence collapses too; other slugs untouched', () => {
    const src = '{{#component:outer}}<a>{{#component:inner}}<b>edited</b>{{/component:inner}}</a>{{/component:outer}}';
    expect(collapseComponentBodies(src, 'inner')).toBe(
      '{{#component:outer}}<a>{{#component:inner}}{{/component:inner}}</a>{{/component:outer}}',
    );
  });

  test('slug no longer present throws instead of silently doing nothing', () => {
    expect(() => collapseComponentBodies('text only', 'card')).toThrow(/stale/);
  });
});

describe('removeSlotOverride (revert override → default shows again)', () => {
  test('drops only the named fill; body and sibling overrides survive byte-for-byte', () => {
    const src = '{{#component:card}}<x/>{{#slot:a}}fill-a{{/slot:a}}{{#slot:b}}fill-b{{/slot:b}}{{/component:card}}';
    expect(removeSlotOverride(src, { slug: 'card', occurrenceIndex: 0 }, 'a')).toBe(
      '{{#component:card}}<x/>{{#slot:b}}fill-b{{/slot:b}}{{/component:card}}',
    );
  });

  test('empty override (deliberate blank) is removable like any other fill', () => {
    const src = '{{#component:card}}{{#slot:a}}{{/slot:a}}{{/component:card}}';
    expect(removeSlotOverride(src, { slug: 'card', occurrenceIndex: 0 }, 'a')).toBe(
      '{{#component:card}}{{/component:card}}',
    );
  });

  test('an occurrence that no longer exists throws instead of rewriting a different region', () => {
    const src =
      '{{#component:hero}}<y/>{{/component:hero}}{{#component:promo}}{{#slot:a}}x{{/slot:a}}{{/component:promo}}';
    expect(() => removeSlotOverride(src, { slug: 'footer', occurrenceIndex: 0 }, 'a')).toThrow(/stale/);
  });

  test('an occurrence rank past the last match throws', () => {
    const src = '{{#component:card}}{{#slot:a}}x{{/slot:a}}{{/component:card}}';
    expect(() => removeSlotOverride(src, { slug: 'card', occurrenceIndex: 1 }, 'a')).toThrow(/stale/);
  });

  test('no matching component in the source throws', () => {
    expect(() => removeSlotOverride('text only', { slug: 'card', occurrenceIndex: 0 }, 'a')).toThrow(/stale/);
  });

  test('addresses by slug-rank, surviving a sibling shift that would silently retarget a positional path', () => {
    const before =
      '{{#component:header}}{{#slot:a}}first{{/slot:a}}{{/component:header}}' +
      '{{#component:header}}{{#slot:a}}second{{/slot:a}}{{/component:header}}';
    const second = collectComponentRegions(before)[1];
    expect(second.occurrenceIndex).toBe(1);

    const after = `inserted ${before}`;
    expect(removeSlotOverride(after, second, 'a')).toBe(
      'inserted {{#component:header}}{{#slot:a}}first{{/slot:a}}{{/component:header}}' +
        '{{#component:header}}{{/component:header}}',
    );
  });
});

describe('slotDefaultContent (revert-override preview from the stored cascade body)', () => {
  test('returns the :default region content for the slot name', () => {
    const stored =
      '<mj-section>{{#slot:greeting:default}}<mj-text>Hello!</mj-text>{{/slot:greeting:default}}</mj-section>';
    expect(slotDefaultContent(stored, 'greeting')).toBe('<mj-text>Hello!</mj-text>');
  });

  test('empty :default (injection point) previews as the empty string, not undefined', () => {
    const stored = '{{#slot:body:default}}{{/slot:body:default}}';
    expect(slotDefaultContent(stored, 'body')).toBe('');
  });

  test('unknown slot name → undefined', () => {
    expect(slotDefaultContent('<mj-text>no slots</mj-text>', 'missing')).toBeUndefined();
  });

  test('grammar-malformed stored body → undefined (no default to preview), does not throw', () => {
    expect(slotDefaultContent('{{#slot: x:default}}y{{/slot:x:default}}', 'x')).toBeUndefined();
  });
});
