/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import { type PreflightResult, runPreflight } from '@template/email/preflight';
import { decompose } from '@template/email/render/decompose';
import { expandWith } from '@template/email/render/expand';
import { interpolate, type Variables } from '@template/email/render/interpolate';
import { lookupCascade } from '@template/email/render/lookupCascade';
import type { RuleErrorSink } from '@template/email/render/settle';
import type { OwnerScope } from '@template/email/render/types';
import { collectConditionFieldPaths } from '@template/email/rules/collectHydrationPaths';
import { emailProjection, emailSurface } from '@template/email/rules/emailProjection';
import { assertValidConditions } from '@template/email/validations/validateConditions';
import mjml2html from 'mjml';
import { emailTemplateRuleSurface } from '#/modules/emailTemplate/services/emailTemplateRuleSurface';

export type EmailTemplatePreflightInput = { mjml: string; subject?: string; slug?: string; locale?: string };

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

export const emailTemplatePreflight = async (
  input: EmailTemplatePreflightInput,
): Promise<EmailTemplatePreflightResult> => {
  const locale = input.locale ?? 'en';
  const ctx: OwnerScope = { ownerModel: 'default', locale };

  assertValidConditions(input.mjml);
  if (input.subject) assertValidConditions(input.subject, { isSubject: true });

  const renderWarnings: string[] = [];
  const onRenderWarning: RuleErrorSink = (issue) => {
    if (issue.kind !== 'token') renderWarnings.push(issue.detail);
  };

  const expandedMjml = await expandDraft(input.mjml, ctx);
  const interpolatedMjml = interpolate(expandedMjml, SAMPLE_VARIABLES, onRenderWarning, { locale });
  const subject = input.subject ? interpolate(input.subject, SAMPLE_VARIABLES, onRenderWarning, { locale }) : '';
  const { html } = await mjml2html(interpolatedMjml, { validationLevel: 'skip' });

  const lens = input.slug
    ? (await emailTemplateRuleSurface(input.slug, locale)).source
    : emailSurface(emailProjection());

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
