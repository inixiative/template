import { describe, expect, it } from 'bun:test';
import type { Condition } from '@inixiative/json-rules';
import { type BindingChain, loopFrames, narrowToElements, scopedRule } from '@template/email/rules/scopedRule';

const eq = (field: string, value: unknown, extra: Record<string, unknown> = {}): Condition =>
  ({ field, operator: 'equals', value, ...extra }) as Condition;

const oneLoop: BindingChain = new Map([['item', 'recipient.tagAttachments']]);
const nested: BindingChain = new Map([
  ['ref', 'recipient.providerRefs'],
  ['member', 'recipient.providerRefs.segmentMembers'],
]);

describe('scopedRule — a loop-bound rule becomes the array rule it always was', () => {
  it('no bindings: the rule is returned as written', () => {
    const rule = eq('recipient.name', 'Ann');
    expect(scopedRule(rule, undefined).rule).toBe(rule);
    expect(scopedRule(rule, new Map()).rule).toBe(rule);
  });

  it('field: the iterated path becomes the array rule, the binding leaf its element-relative condition', () => {
    expect(scopedRule(eq('item.tag.name', 'vip'), oneLoop).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: eq('tag.name', 'vip'),
    });
  });

  it('a root leaf inside the loop climbs to the lens root with $$', () => {
    expect(scopedRule(eq('recipient.name', 'Ann'), oneLoop).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: eq('$$.name', 'Ann'),
    });
  });

  it('path: a comparison to the element and to the root are both attributable', () => {
    expect(scopedRule(eq('item.tag.name', undefined, { path: 'recipient.name' }), oneLoop).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: eq('tag.name', undefined, { path: '$$.name' }),
    });
    expect(scopedRule(eq('recipient.name', undefined, { path: 'item.tag.name' }), oneLoop).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: eq('$$.name', undefined, { path: '$.tag.name' }),
    });
  });

  it('value and bind are never paths and pass through untouched', () => {
    const rule = { field: 'item.tag.id', operator: 'equals', bind: 'tagId', bindOptional: true } as Condition;
    expect(scopedRule(rule, oneLoop).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'equals', bind: 'tagId', bindOptional: true },
    });
    expect(scopedRule(eq('item.tag.name', 'item.tag.name'), oneLoop).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: eq('tag.name', 'item.tag.name'),
    });
  });

  it('nested loops chain relative to the enclosing element; the outer binding is one level up', () => {
    expect(scopedRule({ all: [eq('member.segment.id', 's1'), eq('ref.customerModel', 'User')] }, nested).rule).toEqual({
      field: 'recipient.providerRefs',
      arrayOperator: 'any',
      condition: {
        field: 'segmentMembers',
        arrayOperator: 'any',
        condition: { all: [eq('segment.id', 's1'), eq('$$.customerModel', 'User')] },
      },
    });
  });

  it('an inner loop over a root path iterates the root collection from inside the outer element', () => {
    const chain: BindingChain = new Map([
      ['item', 'recipient.tagAttachments'],
      ['ref', 'recipient.providerRefs'],
    ]);
    expect(scopedRule(eq('ref.customerModel', 'User'), chain).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: '$$.providerRefs', arrayOperator: 'any', condition: eq('customerModel', 'User') },
    });
  });

  it('an array rule written inside the loop keeps its own element scope, so a binding leaf under it climbs one more', () => {
    const rule = {
      field: 'item.tag.attachments',
      arrayOperator: 'any',
      condition: eq('resourceModel', undefined, { path: 'item.resourceModel' }),
    } as Condition;
    expect(scopedRule(rule, oneLoop).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: {
        field: 'tag.attachments',
        arrayOperator: 'any',
        condition: eq('resourceModel', undefined, { path: '$$.resourceModel' }),
      },
    });
  });

  it('if/then/else and all/any are transparent', () => {
    // biome-ignore lint/suspicious/noThenProperty: rule DSL object, not a Promise
    const out = scopedRule(
      { if: eq('item.a', 1), then: eq('item.b', 2), else: { any: [eq('item.c', 3)] } },
      oneLoop,
    ).rule;
    expect((out as { condition: unknown }).condition).toEqual({
      if: eq('a', 1),
      // biome-ignore lint/suspicious/noThenProperty: rule DSL object, not a Promise
      then: eq('b', 2),
      else: { any: [eq('c', 3)] },
    });
  });

  it('an index leaf is a counter, not a path; the element itself and another lens root are issues, never rules', () => {
    const withIndex: BindingChain = new Map([...oneLoop, ['i', undefined]]);
    expect(scopedRule(eq('i', 0), withIndex).rule).toEqual({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: true,
    });
    expect((scopedRule(eq('i', 0), withIndex, { indices: { i: 0 } }).rule as { condition: unknown }).condition).toBe(
      true,
    );
    expect((scopedRule(eq('i', 0), withIndex, { indices: { i: 2 } }).rule as { condition: unknown }).condition).toBe(
      false,
    );
    expect(scopedRule(eq('i', 0), withIndex, { indices: {} }).issue).toContain('not available here');
    expect(scopedRule(eq('item.tag.name', undefined, { path: 'i' }), withIndex).issue).toContain(
      'loop index as a path',
    );
    expect(scopedRule(eq('item', null), oneLoop).issue).toContain('loop element itself');
    expect(scopedRule(eq('sender.id', 'o1'), oneLoop).issue).toContain(
      'reads the sender lens from inside a loop over recipient',
    );
    expect(scopedRule({ all: [eq('item.tag.name', 'vip'), eq('sender.id', 'o1')] }, oneLoop).issue).toContain('sender');
    const crossLoop: BindingChain = new Map([...oneLoop, ['s', 'sender.spaces']]);
    expect(scopedRule(eq('s.id', 'x'), crossLoop).issue).toContain('nested loops must stay within one lens');
  });

  it('a loop over the opaque data bag comes back as written: nothing to fold, any root may be read', () => {
    const data: BindingChain = new Map([['item', 'data.items']]);
    const rule = { all: [eq('item.active', true), eq('recipient.name', 'Ann'), eq('item', 'x')] };
    expect(scopedRule(rule, data).rule).toBe(rule);
  });

  it('loopFrames keeps loop order and drops index bindings', () => {
    expect(loopFrames(new Map([...nested, ['i', undefined]]))).toEqual([
      { as: 'ref', path: 'recipient.providerRefs' },
      { as: 'member', path: 'recipient.providerRefs.segmentMembers' },
    ]);
  });

  it('narrowToElements pins every iterated collection to the element in scope, without touching the scope', () => {
    const member = { segment: { id: 's1' } };
    const ref = { customerModel: 'User', segmentMembers: [member, { segment: { id: 's2' } }] };
    const recipient = { name: 'Ann', providerRefs: [ref, { customerModel: 'Space', segmentMembers: [] }] };
    const scope = { recipient, sender: { id: 'o1' }, ref, member };
    const narrowed = narrowToElements(scope, loopFrames(nested));
    expect(narrowed).toEqual({
      recipient: { name: 'Ann', providerRefs: [{ customerModel: 'User', segmentMembers: [member] }] },
      sender: { id: 'o1' },
    });
    expect(recipient.providerRefs).toHaveLength(2);
    expect(ref.segmentMembers).toHaveLength(2);
  });
});
