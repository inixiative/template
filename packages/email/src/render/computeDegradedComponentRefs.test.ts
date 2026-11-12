/**
 * @atlas
 * @kind test
 * @partOf feature:email
 * @uses none
 */
import { describe, expect, it } from 'bun:test';
import { computeDegradedComponentRefs } from '@template/email/render/computeDegradedComponentRefs';

describe('computeDegradedComponentRefs', () => {
  it('returns sorted unique missing slugs and ignores circular references', async () => {
    const missing = await computeDegradedComponentRefs(
      '{{#component:z}}{{/component:z}}{{#component:a}}{{/component:a}}{{#component:z}}{{/component:z}}{{#component:cycle}}{{/component:cycle}}',
      async () => ({ cycle: { mjml: '{{#component:cycle}}{{/component:cycle}}' } }),
    );
    expect(missing).toEqual(['a', 'z']);
  });
});
