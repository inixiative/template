/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import type { CommunicationKind } from '@template/db/generated/client/client';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import {
  type ComposeTemplateResult,
  composeTemplate,
  fetchTemplateLens,
  fetchTemplateThroughOwnerCascade,
  type OwnerScope,
  ownerScopeOfRow,
  type RenderIssue,
  type RuleErrorSink,
  recomputeAndStoreMissingComponentSlugs,
  type Variables,
} from '@template/email/render';
import { type EmailLens, narrowVariables } from '@template/email/rules';
import { LogScope, log } from '@template/shared/logger';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { type RenderIssuePolicy, renderPolicyFor } from '#/lib/email/emailTemplateRegistry';
import { fetchReferenceKeysExcludingDegradedSegments } from '#/lib/email/fetchReferenceKeysExcludingDegradedSegments';
import { renderForRecipient } from '#/lib/email/renderForRecipient';
import type { Sender } from '#/lib/email/sender';

export const senderToOwnerScope = (sender: Sender): OwnerScope => {
  switch (sender.type) {
    case 'Organization':
      return { locale: 'en', ownerModel: 'Organization', organizationId: sender.organizationId };
    case 'OrganizationUser':
      return {
        locale: 'en',
        ownerModel: 'OrganizationUser',
        organizationId: sender.organizationId,
        userId: sender.userId,
      };
    case 'Space':
      return {
        locale: 'en',
        ownerModel: 'Space',
        spaceId: sender.spaceId,
        organizationId: sender.organizationId,
      };
    case 'SpaceUser':
      return {
        locale: 'en',
        ownerModel: 'SpaceUser',
        spaceId: sender.spaceId,
        organizationId: sender.organizationId,
        userId: sender.userId,
      };
    case 'User':
      return { locale: 'en', ownerModel: 'User', userId: sender.userId };
    case 'admin':
      return { locale: 'en', ownerModel: 'admin' };
    case 'platform':
      return { locale: 'en', ownerModel: 'default' };
    default:
      return { locale: 'en', ownerModel: 'default' };
  }
};

export type RenderedEmailTemplate = {
  slug: string;
  subject: string;
  mjml: string;
  kind: CommunicationKind;
  emailTemplateId: string;
  emailTemplateAuditLogId: string | null;
  variables: Variables;
  componentResolutions: Record<string, string>;
  issues: RenderIssue[];
};

type Rendered = {
  renderedTemplate: RenderedEmailTemplate;
  subjectIssues: RenderIssue[];
  ownerModel: OwnerScope['ownerModel'];
};

const renderComposed = (
  slug: string,
  composed: ComposeTemplateResult,
  vars: Variables,
  scope: OwnerScope,
  lens: EmailLens,
  existingTargets: ReadonlySet<string>,
): Rendered => {
  const issues: RenderIssue[] = [];
  const subjectIssues: RenderIssue[] = [];
  const bodySink: RuleErrorSink = (issue) => issues.push(issue);
  const subjectSink: RuleErrorSink = (issue) => subjectIssues.push(issue);
  const options = { locale: scope.locale, existingTargets };
  const mjml = renderForRecipient(composed.mjml, vars, lens, { ...options, onError: bodySink });
  const subject = renderForRecipient(composed.subject, vars, lens, {
    ...options,
    onError: subjectSink,
  });
  return {
    renderedTemplate: {
      slug,
      subject,
      mjml,
      kind: composed.kind,
      emailTemplateId: composed.id,
      emailTemplateAuditLogId: composed.emailTemplateAuditLogId,
      variables: narrowVariables(lens, vars),
      componentResolutions: composed.componentResolutions,
      issues,
    },
    subjectIssues,
    ownerModel: composed.ownerModel,
  };
};

const describe = (issues: RenderIssue[]): string =>
  [...new Set(issues.map((issue) => issue.detail))].join('; ');

export type RenderPolicy = { onIssue: RenderIssuePolicy; substitute?: string };

export const renderEmailTemplateWithFallback = async (
  template: string,
  sender: Sender,
  variablesFor: (lens: EmailLens) => Promise<Variables>,
  systemVarsForKind?: (kind: CommunicationKind) => Record<string, unknown>,
  policy: RenderPolicy = renderPolicyFor(template),
): Promise<RenderedEmailTemplate> => {
  const scope = senderToOwnerScope(sender);
  let primaryLens: EmailLens | undefined;

  const primaryBound = async (): Promise<EmailLens> => {
    if (primaryLens) return primaryLens;
    const row = await fetchTemplateThroughOwnerCascade(template, scope);
    return row
      ? emailLensFor(template, ownerScopeOfRow(row), await fetchTemplateLens(template, row), sender)
      : emailLensFor(template, scope, undefined, sender);
  };

  const render = async (
    slug: string,
    at: OwnerScope = scope,
    bound?: EmailLens,
  ): Promise<Rendered> => {
    const composed = await composeTemplate(slug, at);
    const lens = bound ?? emailLensFor(slug, composed.owner, composed.lens, sender);
    if (!bound) primaryLens = lens;
    const variables = await variablesFor(lens);
    const vars: Variables = systemVarsForKind
      ? { ...variables, system: { ...variables.system, ...systemVarsForKind(composed.kind) } }
      : variables;
    const existingTargets = await fetchReferenceKeysExcludingDegradedSegments(
      composed.existingTargets,
    );
    return renderComposed(slug, composed, vars, at, lens, existingTargets);
  };

  const clean = (rendered: Rendered): boolean =>
    !rendered.subjectIssues.length && !rendered.renderedTemplate.issues.length;

  let primaryKind: CommunicationKind | undefined;
  let primaryOwner: OwnerScope['ownerModel'] | undefined;

  const platformScope: OwnerScope = { locale: scope.locale, ownerModel: 'default' };

  const fallback = async (
    reason: string,
    slug: string,
    at: OwnerScope,
    label: string,
  ): Promise<RenderedEmailTemplate> => {
    log.warn(
      `Email ${label}: template=${template} → ${slug}@${at.ownerModel} — ${reason}`,
      LogScope.email,
    );
    const rendered = await render(slug, at, await primaryBound());
    if (!clean(rendered)) {
      throw new EmailRenderError(slug, 'render_failed', [
        describe([...rendered.subjectIssues, ...rendered.renderedTemplate.issues]),
      ]);
    }
    return { ...rendered.renderedTemplate, kind: primaryKind ?? rendered.renderedTemplate.kind };
  };

  const substituted = async (reason: string): Promise<RenderedEmailTemplate> => {
    if (policy.substitute) return fallback(reason, policy.substitute, scope, 'substituted');
    const platformCanDiffer =
      primaryOwner !== 'default' && primaryOwner !== 'admin' && scope.ownerModel !== 'admin';
    if (policy.onIssue === 'platform' && platformCanDiffer)
      return fallback(reason, template, platformScope, 'unbranded');
    throw new EmailRenderError(template, 'render_failed', [reason]);
  };

  let rendered: Rendered;
  try {
    rendered = await render(template);
    primaryKind = rendered.renderedTemplate.kind;
    primaryOwner = rendered.ownerModel;
  } catch (error) {
    if (
      error instanceof EmailRenderError &&
      error.type !== 'render_failed' &&
      error.type !== 'recipient_missing' &&
      error.type !== 'data_missing'
    ) {
      if (error.type === 'component_missing') {
        try {
          const row = await fetchTemplateThroughOwnerCascade(template, scope);
          if (row && !row.missingComponentSlugs.length)
            await recomputeAndStoreMissingComponentSlugs('EmailTemplate', row.id);
        } catch (refreshError) {
          log.error(
            { error: refreshError, template, ownerModel: scope.ownerModel },
            'Email degradation recompute failed',
            LogScope.email,
          );
        }
      }
      return substituted(error.message);
    }
    throw error;
  }

  if (rendered.subjectIssues.length)
    return substituted(`subject: ${describe(rendered.subjectIssues)}`);
  if (!rendered.renderedTemplate.issues.length) return rendered.renderedTemplate;

  const summary = describe(rendered.renderedTemplate.issues);
  if (policy.onIssue !== 'degrade') return substituted(summary);

  log.warn(
    `Email render degraded: template=${template} owner=${scope.ownerModel} — ${summary}`,
    LogScope.email,
  );
  return rendered.renderedTemplate;
};
