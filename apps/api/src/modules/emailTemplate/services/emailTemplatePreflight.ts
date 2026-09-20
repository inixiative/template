/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import { admitRuleReferences } from '@template/db';
import { type PreflightResult, runPreflight } from '@template/email/preflight';
import { decompose } from '@template/email/render/decompose';
import { expandWith } from '@template/email/render/expand';
import { interpolate, type Variables } from '@template/email/render/interpolate';
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { EmailOwnerRef } from '@template/email/render/owner';
import type { RuleErrorSink } from '@template/email/render/settle';
import type { OwnerScope } from '@template/email/render/types';
import { collectConditionFieldPaths } from '@template/email/rules/collectHydrationPaths';
import { type EmailLens, emailSourceQueries } from '@template/email/rules/emailLens';
import { emptyRowFor } from '@template/email/rules/emptyRowFor';
import { contentRuleReferences } from '@template/email/rules/ruleReferences';
import { assertValidConditions } from '@template/email/validations/validateConditions';
import type { RuleReference } from '@template/shared/rules';
import mjml2html from 'mjml';
import { emailLensAt, emailLensFor } from '#/lib/email/emailLensFor';
import { withoutDegradedSegments } from '#/lib/email/withoutDegradedSegments';

export type EmailTemplatePreflightInput = Partial<EmailOwnerRef> & {
  mjml: string;
  subject?: string;
  slug?: string;
  locale?: string;
};

export type EmailTemplatePreflightResult = PreflightResult & { renderWarnings: string[] };

const SAMPLE_VARIABLES: Variables = {
  recipient: { id: 'sample-recipient', name: 'Sample Recipient', email: 'recipient@example.com' },
  sender: { name: 'Your Team', email: 'hello@example.com' },
  data: {},
  system: { unsubscribeUrl: 'https://example.com/unsubscribe' },
};

const expandDraft = (mjml: string, ctx: OwnerScope): Promise<string> => {
  const { mjml: bareRefMjml, writes } = decompose(mjml, () => undefined);
  const drafted = new Map(writes.map((write) => [write.slug, write.mjml]));
  return expandWith(bareRefMjml, async (slugs) => {
    const missing = slugs.filter((slug) => !drafted.has(slug));
    const persisted = missing.length ? await lookupCascade(missing, ctx) : {};
    return Object.fromEntries(
      slugs.map((slug) => {
        const draft = drafted.get(slug);
        return [slug, draft === undefined ? persisted[slug] : { mjml: draft }];
      }),
    );
  });
};

const admittedReferences = async (lens: EmailLens, ...contents: string[]): Promise<RuleReference[]> =>
  (await admitRuleReferences(emailSourceQueries(lens), contentRuleReferences(lens, ...contents))).admitted;

const sampleVariables = (lens: EmailLens): Variables => ({
  ...SAMPLE_VARIABLES,
  recipient: { ...emptyRowFor(lens.recipient), ...SAMPLE_VARIABLES.recipient },
  sender: { ...emptyRowFor(lens.sender), ...SAMPLE_VARIABLES.sender },
});

export const emailTemplatePreflight = async (
  input: EmailTemplatePreflightInput,
): Promise<EmailTemplatePreflightResult> => {
  const locale = input.locale ?? 'en';
  const ctx: OwnerScope = {
    ownerModel: input.ownerModel ?? 'default',
    organizationId: input.organizationId,
    spaceId: input.spaceId,
    userId: input.userId,
    locale,
  };

  assertValidConditions(input.mjml);
  if (input.subject) assertValidConditions(input.subject, { isSubject: true });

  const lens = input.slug ? await emailLensAt(input.slug, ctx) : emailLensFor(undefined, ctx);
  const variables = sampleVariables(lens);

  const renderWarnings: string[] = [];
  const onRenderWarning: RuleErrorSink = (issue) => {
    if (issue.kind !== 'token') renderWarnings.push(issue.detail);
  };

  const expandedMjml = await expandDraft(input.mjml, ctx);
  const liveRefs = await withoutDegradedSegments(await admittedReferences(lens, expandedMjml, input.subject ?? ''));
  const options = { locale, lens, liveRefs };
  const interpolatedMjml = interpolate(expandedMjml, variables, onRenderWarning, options);
  const subject = input.subject ? interpolate(input.subject, variables, onRenderWarning, options) : '';
  const { html } = await mjml2html(interpolatedMjml, { validationLevel: 'skip' });

  const result = await runPreflight({
    mjml: expandedMjml,
    subject,
    html,
    fieldPaths: collectConditionFieldPaths(`${expandedMjml}\n${input.subject ?? ''}`),
    renderWarnings,
    lens,
    tokenUnresolvedSeverity: input.slug ? 'error' : 'warning',
  });

  return { ...result, renderWarnings };
};
