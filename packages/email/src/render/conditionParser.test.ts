import { describe, expect, it } from 'bun:test';
import {
  EACH,
  findJsonEnd,
  IF,
  isStructurallyBalanced,
  isValidBindingIdentifier,
  parseEachBlock,
  parseIfBlock,
} from '@template/email/render/conditionParser';

const rule = (field: string, operator: string, value: unknown): string => JSON.stringify({ field, operator, value });

const openIndex = (content: string): number => content.indexOf(IF);
const eachIndex = (content: string): number => content.indexOf(EACH);

describe('findJsonEnd', () => {
  it('returns the index of the matching closing brace for a flat object', () => {
    expect(findJsonEnd('{"a":1}rest', 0)).toBe(6);
  });

  it('handles nested objects', () => {
    expect(findJsonEnd('{"a":{"b":2}}tail', 0)).toBe(12);
  });

  it('ignores braces inside strings', () => {
    expect(findJsonEnd('{"a":"}{"}x', 0)).toBe(9);
  });

  it('respects escaped quotes inside strings', () => {
    expect(findJsonEnd('{"a":"\\""}z', 0)).toBe(9);
  });

  it('returns -1 when the object is never closed', () => {
    expect(findJsonEnd('{"a":1', 0)).toBe(-1);
  });
});

describe('parseIfBlock — simple if', () => {
  it('parses a single if branch', () => {
    const content = `{{#if rule=${rule('recipient.tier', 'equals', 'gold')}}}BODY{{/if}}`;
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches).toHaveLength(1);
    expect(block!.branches[0]!.kind).toBe('if');
    expect(block!.branches[0]!.body).toBe('BODY');
    expect(block!.branches[0]!.rule).toEqual({ field: 'recipient.tier', operator: 'equals', value: 'gold' });
    expect(block!.end).toBe(content.length);
  });

  it('parses a bare boolean rule', () => {
    const content = '{{#if rule=true}}X{{/if}}';
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches[0]!.rule).toBe(true as unknown as never);
    expect(block!.branches[0]!.body).toBe('X');
  });

  it('tolerates whitespace around the rule JSON inside the marker', () => {
    const content = `{{#if rule= ${rule('recipient.tier', 'equals', 'gold')} }}BODY{{/if}}`;
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches[0]!.rule).toEqual({ field: 'recipient.tier', operator: 'equals', value: 'gold' });
    expect(block!.branches[0]!.body).toBe('BODY');
    expect(block!.end).toBe(content.length);
  });
});

describe('parseIfBlock — if/else', () => {
  it('parses an if and an else branch', () => {
    const content = `{{#if rule=${rule('a', 'equals', 1)}}}YES{{else}}NO{{/if}}`;
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches.map((b) => b.kind)).toEqual(['if', 'else']);
    expect(block!.branches[0]!.body).toBe('YES');
    expect(block!.branches[1]!.body).toBe('NO');
    expect(block!.branches[1]!.rule).toBeUndefined();
  });
});

describe('parseIfBlock — if/else-if/else', () => {
  it('parses all three branch kinds in order', () => {
    const content = `{{#if rule=${rule('t', 'equals', 'g')}}}G{{else if rule=${rule('t', 'equals', 's')}}}S{{else}}B{{/if}}`;
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches.map((b) => b.kind)).toEqual(['if', 'elseIf', 'else']);
    expect(block!.branches.map((b) => b.body)).toEqual(['G', 'S', 'B']);
    expect(block!.branches[1]!.rule).toEqual({ field: 't', operator: 'equals', value: 's' });
  });
});

describe('parseIfBlock — nesting', () => {
  it('nested if/else does not split the outer branches', () => {
    const outer = rule('t', 'equals', 'g');
    const inner = rule('v', 'equals', true);
    const content = `{{#if rule=${outer}}}A{{#if rule=${inner}}}B{{else}}C{{/if}}D{{else}}E{{/if}}`;
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches.map((b) => b.kind)).toEqual(['if', 'else']);
    expect(block!.branches[0]!.body).toBe(`A{{#if rule=${inner}}}B{{else}}C{{/if}}D`);
    expect(block!.branches[1]!.body).toBe('E');
    expect(block!.end).toBe(content.length);
  });

  it('a nested boolean rule does not corrupt outer depth tracking', () => {
    const outer = rule('t', 'equals', 'g');
    const content = `{{#if rule=${outer}}}A{{#if rule=true}}B{{/if}}C{{else}}D{{/if}}`;
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches.map((b) => b.kind)).toEqual(['if', 'else']);
    expect(block!.branches[1]!.body).toBe('D');
  });
});

describe('parseIfBlock — malformed input', () => {
  it('returns null when the opening marker is not a valid if', () => {
    expect(parseIfBlock('no if here', 0)).toBeNull();
  });

  it('returns null when the if block is never closed', () => {
    const content = `{{#if rule=${rule('a', 'equals', 1)}}}BODY no end here`;
    expect(parseIfBlock(content, openIndex(content))).toBeNull();
  });

  it('captures a ruleError instead of a rule for malformed JSON', () => {
    const content = '{{#if rule={bad json}}}A{{/if}}';
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches[0]!.rule).toBeUndefined();
    expect(typeof block!.branches[0]!.ruleError).toBe('string');
    expect(block!.branches[0]!.body).toBe('A');
  });

  it('returns null when the opening marker has no closing braces', () => {
    const content = '{{#if rule=true and never closes';
    expect(parseIfBlock(content, openIndex(content))).toBeNull();
  });

  it('falls back to indexOf when an object rule is not immediately followed by }}', () => {
    const content = `{{#if rule=${rule('a', 'equals', 1)} trailing}}A{{/if}}`;
    const block = parseIfBlock(content, openIndex(content));

    expect(block).not.toBeNull();
    expect(block!.branches[0]!.ruleError).toBeDefined();
    expect(block!.branches[0]!.body).toBe('A');
  });
});

describe('isValidBindingIdentifier', () => {
  it('accepts letter-first lowercase-alphanumeric-hyphen identifiers', () => {
    expect(isValidBindingIdentifier('m')).toBe(true);
    expect(isValidBindingIdentifier('mission')).toBe(true);
    expect(isValidBindingIdentifier('mission-2')).toBe(true);
  });

  it('rejects a leading digit or hyphen (letter-first, unlike SLUG_PATTERN)', () => {
    expect(isValidBindingIdentifier('2m')).toBe(false);
    expect(isValidBindingIdentifier('-m')).toBe(false);
  });

  it('rejects uppercase and underscores', () => {
    expect(isValidBindingIdentifier('Mission')).toBe(false);
    expect(isValidBindingIdentifier('my_mission')).toBe(false);
  });
});

describe('parseEachBlock — grammar', () => {
  it('parses a simple each with as= only', () => {
    const content = '{{#each recipient.missions as=m}}BODY{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.path).toBe('recipient.missions');
    expect(block!.as).toBe('m');
    expect(block!.asMissing).toBe(false);
    expect(block!.index).toBeUndefined();
    expect(block!.filter).toBeUndefined();
    expect(block!.body).toBe('BODY');
    expect(block!.end).toBe(content.length);
  });

  it('tolerates as=/index=/filter= in any order', () => {
    const filterJson = rule('m.status', 'equals', 'active');
    const orderings = [
      `{{#each recipient.missions as=m index=i filter=${filterJson}}}X{{/each}}`,
      `{{#each recipient.missions index=i as=m filter=${filterJson}}}X{{/each}}`,
      `{{#each recipient.missions filter=${filterJson} index=i as=m}}X{{/each}}`,
    ];

    for (const content of orderings) {
      const block = parseEachBlock(content, eachIndex(content));
      expect(block).not.toBeNull();
      expect(block!.as).toBe('m');
      expect(block!.index).toBe('i');
      expect(block!.filter).toEqual({ field: 'm.status', operator: 'equals', value: 'active' });
      expect(block!.body).toBe('X');
    }
  });

  it('missing as= is a soft parse outcome, not a throw', () => {
    const content = '{{#each recipient.missions index=i}}X{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.as).toBeUndefined();
    expect(block!.asMissing).toBe(true);
    expect(block!.index).toBe('i');
  });

  it('retains unknown and duplicate attributes as validation errors instead of silently discarding them', () => {
    const content = '{{#each recipient.missions as=first typo=value as=second}}X{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.attributeErrors).toEqual([
      'unknown typo= attribute on {{#each}} block',
      'duplicate as= attribute on {{#each}} block',
    ]);
  });

  it('retains attributes missing = as validation errors without losing the closed block structure', () => {
    const content = '{{#each recipient.missions as item}}X{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.body).toBe('X');
    expect(block!.attributeErrors).toEqual([
      'malformed attribute "as" on {{#each}} block (expected name=value)',
      'malformed attribute "item" on {{#each}} block (expected name=value)',
    ]);
  });

  it('captures a filterError instead of a filter for malformed filter JSON, without failing the parse', () => {
    const content = '{{#each recipient.missions as=m filter={bad json}}}X{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.filter).toBeUndefined();
    expect(typeof block!.filterError).toBe('string');
    expect(block!.body).toBe('X');
  });

  it('diagnoses filter= JSON that never closes as a filter error, not an unterminated block', () => {
    const content = '{{#each recipient.missions as=m filter={{{}}X{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.filterError).toBe('filter JSON never closes');
    expect(block!.body).toBe('X');
  });

  it('returns null when the each never closes (unterminated)', () => {
    const content = '{{#each recipient.missions as=m}}no end here';
    expect(parseEachBlock(content, eachIndex(content))).toBeNull();
  });

  it('returns null when the open marker itself never closes with }}', () => {
    const content = '{{#each recipient.missions as=m and never closes';
    expect(parseEachBlock(content, eachIndex(content))).toBeNull();
  });

  it('nests each inside each — the outer body carries the full nested markup', () => {
    const content = '{{#each recipient.a as=x}}[{{#each x.b as=y}}({{y}}){{/each}}]{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.path).toBe('recipient.a');
    expect(block!.body).toBe('[{{#each x.b as=y}}({{y}}){{/each}}]');
    expect(block!.end).toBe(content.length);
  });

  it('nests an if inside an each without corrupting the each body boundary', () => {
    const content = '{{#each recipient.a as=x}}{{#if rule=true}}Y{{/if}} tail{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.body).toBe('{{#if rule=true}}Y{{/if}} tail');
    expect(block!.end).toBe(content.length);
  });

  it('a kind-mismatched close ({{#each}}...{{/if}}) degrades to "never closes"', () => {
    const content = '{{#each recipient.a as=x}}X{{/if}} trailing {{/each}}';
    expect(parseEachBlock(content, eachIndex(content))).toBeNull();
  });

  it('a kind-mismatched close from the other direction ({{#if}}...{{/each}}) also degrades', () => {
    const content = '{{#each recipient.a as=x}}{{#if rule=true}}Y{{/each}}{{/if}}';
    expect(parseEachBlock(content, eachIndex(content))).toBeNull();
  });
});

describe('conditionParser — literal end-tags inside {{else if rule=…}} JSON', () => {
  it('an {{else if}} carrying a literal {{/each}} does not truncate the enclosing each-block', () => {
    const content =
      '{{#each data.items as=x}}{{#if rule={"field":"a","operator":"equals","value":"y"}}}A' +
      '{{else if rule={"field":"b","operator":"equals","value":"{{/each}}"}}}B{{/if}}{{/each}}';
    const block = parseEachBlock(content, eachIndex(content));

    expect(block).not.toBeNull();
    expect(block!.path).toBe('data.items');
    expect(block!.as).toBe('x');
    expect(block!.end).toBe(content.length);
    expect(block!.body).toContain('{{else if rule=');
    expect(block!.body).toContain('B{{/if}}');
  });

  it('an {{else if}} carrying a literal {{/if}} does not raise a false straddle on loop-free text', () => {
    const content =
      '{{#if rule={"field":"a","operator":"equals","value":"y"}}}A' +
      '{{else if rule={"field":"b","operator":"equals","value":"{{/if}}"}}}B{{/if}}';

    expect(isStructurallyBalanced(content)).toBe(true);
  });
});

describe('isStructurallyBalanced', () => {
  it('accepts plain text and properly nested if/each blocks', () => {
    expect(isStructurallyBalanced('plain')).toBe(true);
    expect(isStructurallyBalanced('{{#each data.a as=x}}{{#if rule=true}}Y{{/if}}{{/each}}')).toBe(true);
  });

  it('rejects an open without its close, a close without its open, and kind-crossed pairs', () => {
    expect(isStructurallyBalanced('{{#each data.a as=x}}Y')).toBe(false);
    expect(isStructurallyBalanced('Y{{/each}}')).toBe(false);
    expect(isStructurallyBalanced('{{#each data.a as=x}}{{#if rule=true}}Y{{/each}}{{/if}}')).toBe(false);
  });
});
