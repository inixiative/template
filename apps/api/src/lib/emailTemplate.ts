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

type Rendered = { settled: SettledTemplate; subjectIssues: RenderIssue[] };

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

  const render = async (slug: string): Promise<Rendered> => {
    const composed = await composeTemplate(slug, scope);
    const vars: Variables = systemVarsForKind
      ? { ...variables, system: { ...variables.system, ...systemVarsForKind(composed.kind) } }
      : variables;
    const { source } = await emailTemplateRuleSurface(slug, scope.locale);
    return renderComposed(slug, composed, vars, scope, source);
  };

  const clean = (rendered: Rendered): boolean => !rendered.subjectIssues.length && !rendered.settled.issues.length;

  const substituted = async (reason: string): Promise<SettledTemplate> => {
    if (!policy.substitute) throw new EmailRenderError(template, 'render_failed', [reason]);
    log.warn(`Email substituted: template=${template} substitute=${policy.substitute} — ${reason}`, LogScope.email);
    const rendered = await render(policy.substitute);
    if (!clean(rendered)) {
      throw new EmailRenderError(policy.substitute, 'render_failed', [
        describe([...rendered.subjectIssues, ...rendered.settled.issues]),
      ]);
    }
    return rendered.settled;
  };

  let rendered: Rendered;
  try {
    rendered = await render(template);
  } catch (error) {
    if (error instanceof EmailRenderError && error.type !== 'render_failed') return substituted(error.message);
    throw error;
  }

  if (rendered.subjectIssues.length) return substituted(`subject: ${describe(rendered.subjectIssues)}`);
  if (!rendered.settled.issues.length) return rendered.settled;

  const summary = describe(rendered.settled.issues);
  if (policy.onIssue === 'fail') return substituted(summary);

  log.warn(`Email render degraded: template=${template} owner=${scope.ownerModel} — ${summary}`, LogScope.email);
  return rendered.settled;
};
