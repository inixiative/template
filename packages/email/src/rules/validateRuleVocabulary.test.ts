import { describe, expect, it } from 'bun:test';
import { emailRuleNarrowing } from '@template/email/rules/emailRuleLens';
import { contentVocabularyIssues, ruleVocabularyIssues } from '@template/email/rules/validateRuleVocabulary';

describe('ruleVocabularyIssues — the lens owns the rule vocabulary', () => {
  it('the canonical membership spelling is clean', () => {
    expect(
      ruleVocabularyIssues(emailRuleNarrowing, {
        field: 'recipient.tagAttachments',
        arrayOperator: 'any',
        condition: { field: 'tag.id', operator: 'equals', value: 'tag-a' },
      }),
    ).toEqual([]);
  });

  it('an FK-column spelling of a reference is refused — the column is omitted from the vocabulary', () => {
    const issues = ruleVocabularyIssues(emailRuleNarrowing, {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tagId', operator: 'equals', value: 'tag-a' },
    });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('every FK spelling to a referenceable model is refused, on any model that carries one', () => {
    for (const field of ['organizationId', 'spaceId']) {
      expect(
        ruleVocabularyIssues(emailRuleNarrowing, {
          field: field === 'organizationId' ? 'recipient.organizationUsers' : 'recipient.spaceUsers',
          arrayOperator: 'any',
          condition: { field, operator: 'equals', value: 'x' },
        }).length,
      ).toBeGreaterThan(0);
    }
  });

  it('an undeclared relation path to a referenceable id is allowed — and registers (mapDefaults source)', () => {
    expect(
      ruleVocabularyIssues(emailRuleNarrowing, {
        field: 'recipient.tags',
        arrayOperator: 'any',
        condition: { field: 'id', operator: 'equals', value: 'tag-a' },
      }),
    ).toEqual([]);
  });

  it('a typo path is refused instead of silently never matching', () => {
    expect(
      ruleVocabularyIssues(emailRuleNarrowing, { field: 'recipient.zzzNope', operator: 'equals', value: 'x' }).length,
    ).toBeGreaterThan(0);
  });

  it('sender.* and data.* stay authorable — Json boundary, structurally unregisterable', () => {
    expect(
      ruleVocabularyIssues(emailRuleNarrowing, {
        all: [
          { field: 'sender.displayName', operator: 'equals', value: 'x' },
          { field: 'data.tagId', operator: 'equals', value: 'y' },
        ],
      }),
    ).toEqual([]);
  });

  it('contentVocabularyIssues folds every block and branch', () => {
    const bad = JSON.stringify({
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tagId', operator: 'equals', value: 'tag-a' },
    });
    const good = JSON.stringify({ field: 'recipient.name', operator: 'equals', value: 'x' });
    const content = `{{#if rule=${good}}}A{{else if rule=${bad}}}B{{/if}}`;
    expect(contentVocabularyIssues(emailRuleNarrowing, content).length).toBeGreaterThan(0);
    expect(contentVocabularyIssues(emailRuleNarrowing, `{{#if rule=${good}}}A{{/if}}`)).toEqual([]);
  });
});
