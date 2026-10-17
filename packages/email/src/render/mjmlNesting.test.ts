/**
 * @atlas
 * @kind test
 * @partOf feature:email
 * @uses none
 */
import { describe, expect, test } from 'bun:test';
import { canNestMjml, MJML_CHILD_TAGS } from '@template/email/render/mjmlNesting';
import presetDependencies from 'mjml-preset-core/lib/dependencies.js';

describe('MJML nesting contract', () => {
  test('mirrors the preset exactly, so the editor and the compiler cannot disagree', () => {
    const isStringList = (entry: [string, unknown[]]): entry is [string, string[]] =>
      entry[1].every((child) => typeof child === 'string');

    const fromPreset = Object.fromEntries(Object.entries(presetDependencies).filter(isStringList));

    expect(MJML_CHILD_TAGS).toEqual(fromPreset);
  });

  test('rejects the insert that sends every fresh template to a 422', () => {
    expect(canNestMjml('mj-body', 'mj-divider')).toBe(false);
    expect(canNestMjml('mj-body', 'mj-text')).toBe(false);
    expect(canNestMjml('mj-body', 'mj-section')).toBe(true);
  });

  test('pins the two containers authors trip over', () => {
    expect(canNestMjml('mj-section', 'mj-text')).toBe(false);
    expect(canNestMjml('mj-section', 'mj-column')).toBe(true);
    expect(canNestMjml('mj-column', 'mj-text')).toBe(true);
    expect(canNestMjml('mj-group', 'mj-text')).toBe(false);
  });

  test('is permissive where it cannot see the surroundings', () => {
    expect(canNestMjml(null, 'mj-divider')).toBe(true);
    expect(canNestMjml('div', 'mj-divider')).toBe(true);
  });
});
