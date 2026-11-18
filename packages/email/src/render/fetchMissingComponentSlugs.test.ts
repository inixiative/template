/**
 * @atlas
 * @kind test
 * @partOf feature:email
 * @uses none
 */
import { describe, expect, it } from 'bun:test';
import { fetchMissingComponentSlugs } from '@template/email/render/fetchMissingComponentSlugs';

describe('fetchMissingComponentSlugs', () => {
  it('returns sorted unique missing slugs and ignores circular references', async () => {
    const missing = await fetchMissingComponentSlugs(
      '{{#component:z}}{{/component:z}}{{#component:a}}{{/component:a}}{{#component:z}}{{/component:z}}{{#component:cycle}}{{/component:cycle}}',
      async () => ({ cycle: { mjml: '{{#component:cycle}}{{/component:cycle}}' } }),
    );
    expect(missing).toEqual(['a', 'z']);
  });
});
