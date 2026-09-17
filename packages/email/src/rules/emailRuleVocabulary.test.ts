import { describe, expect, it } from 'bun:test';
import { defaultEmailRuleLens } from '@template/email/rules/emailProjection';
import { ruleVocabularyIssues } from '@template/shared/rules';

describe('the email rule lens owns the rule vocabulary', () => {
  it('the canonical membership spelling is clean', () => {
    expect(
      ruleVocabularyIssues(defaultEmailRuleLens, {
        field: 'recipient.tagAttachments',
        arrayOperator: 'any',
        condition: { field: 'tag.id', operator: 'equals', value: 'tag-a' },
      }),
    ).toEqual([]);
  });

  it('an FK-column spelling of a reference is refused — omitForeignKeys drops the column', () => {
    const issues = ruleVocabularyIssues(defaultEmailRuleLens, {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tagId', operator: 'equals', value: 'tag-a' },
    });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('every FK spelling to a referenceable model is refused, on any model that carries one', () => {
    for (const field of ['organizationId', 'spaceId']) {
      expect(
        ruleVocabularyIssues(defaultEmailRuleLens, {
          field: field === 'organizationId' ? 'recipient.organizationUsers' : 'recipient.spaceUsers',
          arrayOperator: 'any',
          condition: { field, operator: 'equals', value: 'x' },
        }).length,
      ).toBeGreaterThan(0);
    }
  });

  it('a relation the lens does not declare is refused, even when it reaches a referenceable id', () => {
    expect(
      ruleVocabularyIssues(defaultEmailRuleLens, {
        field: 'recipient.tags',
        arrayOperator: 'any',
        condition: { field: 'id', operator: 'equals', value: 'tag-a' },
      }).length,
    ).toBeGreaterThan(0);
  });

  it('a typo path is refused instead of silently never matching', () => {
    expect(
      ruleVocabularyIssues(defaultEmailRuleLens, { field: 'recipient.zzzNope', operator: 'equals', value: 'x' }).length,
    ).toBeGreaterThan(0);
  });

  it('data.* stays authorable — Json boundary, structurally unregisterable', () => {
    expect(ruleVocabularyIssues(defaultEmailRuleLens, { field: 'data.tagId', operator: 'equals', value: 'y' })).toEqual(
      [],
    );
  });
});
