import { describe, expect, it } from 'bun:test';
import { collectRules } from '@template/email/render/conditionParser/collectRules';

describe('collectRules', () => {
  it('yields if-branch rules, each filters, and loop-bound rules as the array rules the lens judges', () => {
    const content =
      '{{#if rule={"field":"recipient.name","operator":"exists"}}}a{{/if}}' +
      '{{#each data.items as=item index=i filter={"field":"item.active","operator":"equals","value":true}}}' +
      '{{#if rule={"field":"item.tier","operator":"equals","value":"gold"}}}g{{/if}}' +
      '{{#if rule={"field":"i","operator":"equals","value":0}}}first{{/if}}' +
      '{{/each}}';
    expect(collectRules(content)).toEqual([
      { field: 'recipient.name', operator: 'exists' },
      { field: 'data.items', arrayOperator: 'any', condition: { field: 'active', operator: 'equals', value: true } },
      { field: 'data.items', arrayOperator: 'any', condition: { field: 'tier', operator: 'equals', value: 'gold' } },
    ]);
  });
});
