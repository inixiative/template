/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import type { Lens } from '@inixiative/json-rules';
import type { CommunicationKind } from '@template/db/generated/client/client';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import {
  type ComposeTemplateResult,
  composeTemplate,
  interpolate,
  type OwnerScope,
  type RenderIssue,
  type RuleErrorSink,
  type Variables,
} from '@template/email/render';
import { LogScope, log } from '@template/shared/logger';
import { type RenderIssuePolicy, renderPolicyFor } from '#/lib/email/registry';
import type { Sender } from '#/lib/email/sender';
import { emailTemplateRuleSurface } from '#/modules/emailTemplate/services/emailTemplateRuleSurface';

export const ownerScope = (sender: Sender): OwnerScope => {
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
      return { locale: 'en', ownerModel: 'Space', spaceId: sender.spaceId, organizationId: sender.organizationId };
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

export type SettledTemplate = {
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

type Rendered = { settled: SettledTemplate; subjectIssues: RenderIssue[]; ownerModel: OwnerScope['ownerModel'] };

const renderComposed = (
  slug: string,
  composed: ComposeTemplateResult,
  vars: Variables,
  scope: OwnerScope,
  lens: Lens,
): Rendered => {
  const issues: RenderIssue[] = [];
  const subjectIssues: RenderIssue[] = [];
  const bodySink: RuleErrorSink = (issue) => issues.push(issue);
  const subjectSink: RuleErrorSink = (issue) => subjectIssues.push(issue);
  const options = { locale: scope.locale, liveRefs: composed.liveRuleRefs, lens };
  const mjml = interpolate(composed.mjml, vars, bodySink, options);
  const subject = interpolate(composed.subject, vars, subjectSink, options);
  return {
    settled: {
      slug,
      subject,
      mjml,
      kind: composed.kind,
      emailTemplateId: composed.id,
      emailTemplateAuditLogId: composed.emailTemplateAuditLogId,
      variables: vars,
      componentResolutions: composed.componentResolutions,
      issues,
    },
    subjectIssues,
    ownerModel: composed.ownerModel,
  };
};

const describe = (issues: RenderIssue[]): string => [...new Set(issues.map((issue) => issue.detail))].join('; ');

export type RenderPolicy = { onIssue: RenderIssuePolicy; substitute?: string };

export const settleTemplate = async (
  template: string,
  sender: Sender,
  variables: Variables,
  systemVarsForKind?: (kind: CommunicationKind) => Record<string, unknown>,
  policy: RenderPolicy = renderPolicyFor(template),
): Promise<SettledTemplate> => {
  const scope = ownerScope(sender);

  const render = async (slug: string, at: OwnerScope = scope): Promise<Rendered> => {
    const composed = await composeTemplate(slug, at);
    const vars: Variables = systemVarsForKind
      ? { ...variables, system: { ...variables.system, ...systemVarsForKind(composed.kind) } }
      : variables;
    const { source } = await emailTemplateRuleSurface(slug, at.locale);
    return renderComposed(slug, composed, vars, at, source);
  };

  const clean = (rendered: Rendered): boolean => !rendered.subjectIssues.length && !rendered.settled.issues.length;

  let primaryKind: CommunicationKind | undefined;
  let primaryOwner: OwnerScope['ownerModel'] | undefined;

  const platformScope: OwnerScope = { locale: scope.locale, ownerModel: 'default' };

  const fallback = async (reason: string, slug: string, at: OwnerScope, label: string): Promise<SettledTemplate> => {
    log.warn(`Email ${label}: template=${template} → ${slug}@${at.ownerModel} — ${reason}`, LogScope.email);
    const rendered = await render(slug, at);
    if (!clean(rendered)) {
      throw new EmailRenderError(slug, 'render_failed', [
        describe([...rendered.subjectIssues, ...rendered.settled.issues]),
      ]);
    }
    return { ...rendered.settled, kind: primaryKind ?? rendered.settled.kind };
  };

  const substituted = async (reason: string): Promise<SettledTemplate> => {
    if (policy.substitute) return fallback(reason, policy.substitute, scope, 'substituted');
    const platformCanDiffer = primaryOwner !== 'default' && primaryOwner !== 'admin' && scope.ownerModel !== 'admin';
    if (policy.onIssue === 'platform' && platformCanDiffer)
      return fallback(reason, template, platformScope, 'unbranded');
    throw new EmailRenderError(template, 'render_failed', [reason]);
  };

  let rendered: Rendered;
  try {
    rendered = await render(template);
    primaryKind = rendered.settled.kind;
    primaryOwner = rendered.ownerModel;
  } catch (error) {
    if (error instanceof EmailRenderError && error.type !== 'render_failed') return substituted(error.message);
    throw error;
  }

  if (rendered.subjectIssues.length) return substituted(`subject: ${describe(rendered.subjectIssues)}`);
  if (!rendered.settled.issues.length) return rendered.settled;

  const summary = describe(rendered.settled.issues);
  if (policy.onIssue !== 'degrade') return substituted(summary);

  log.warn(`Email render degraded: template=${template} owner=${scope.ownerModel} — ${summary}`, LogScope.email);
  return rendered.settled;
};
