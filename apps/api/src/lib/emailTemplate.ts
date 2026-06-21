/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import type { CommunicationKind } from '@template/db';
import {
  composeTemplate,
  EmailRenderError,
  interpolate,
  type OwnerScope,
  parentOwner,
  type RuleErrorSink,
  type Variables,
} from '@template/email/render';
import { LogScope, log } from '@template/shared/logger';
import type { Sender } from '#/lib/email/sender';

export const ownerScope = (sender: Sender): OwnerScope => {
  switch (sender.type) {
    case 'Organization':
      return { locale: 'en', ownerModel: 'Organization', organizationId: sender.organizationId };
    case 'OrganizationUser':
      return { locale: 'en', ownerModel: 'Organization', organizationId: sender.organizationId, userId: sender.userId };
    case 'Space':
      return { locale: 'en', ownerModel: 'Space', spaceId: sender.spaceId, organizationId: sender.organizationId };
    case 'SpaceUser':
      return {
        locale: 'en',
        ownerModel: 'Space',
        spaceId: sender.spaceId,
        organizationId: sender.organizationId,
        userId: sender.userId,
      };
    case 'User':
      return { locale: 'en', ownerModel: 'default', userId: sender.userId };
    case 'admin':
      return { locale: 'en', ownerModel: 'admin' };
    default:
      return { locale: 'en', ownerModel: 'default' };
  }
};

export type SettledTemplate = {
  subject: string;
  mjml: string;
  kind: CommunicationKind;
  emailTemplateId: string;
  emailTemplateAuditLogId: string | null;
};

export const settleTemplate = async (
  template: string,
  sender: Sender,
  variables: Variables,
  recipientVarsForKind?: (kind: CommunicationKind) => Record<string, unknown>,
): Promise<SettledTemplate> => {
  const scope = ownerScope(sender);
  let composed = await composeTemplate(template, scope);

  while (true) {
    const errors: string[] = [];
    const onError: RuleErrorSink = (message) => errors.push(message);
    const vars: Variables = recipientVarsForKind
      ? { ...variables, recipient: { ...variables.recipient, ...recipientVarsForKind(composed.kind) } }
      : variables;
    const mjml = interpolate(composed.mjml, vars, onError);
    const subject = interpolate(composed.subject, vars, onError);
    const settled = {
      subject,
      mjml,
      kind: composed.kind,
      emailTemplateId: composed.id,
      emailTemplateAuditLogId: composed.emailTemplateAuditLogId,
    };

    if (!errors.length) return settled;

    log.warn(
      `Email render error: template=${template} owner=${composed.ownerModel} — ${[...new Set(errors)].join('; ')}`,
      LogScope.email,
    );

    const parent = parentOwner(composed.ownerModel);
    const policy = parent ? composed.onError : 'fail';

    if (policy === 'degrade') return settled;
    if (policy === 'fallback' && parent) {
      composed = await composeTemplate(template, { ...scope, ownerModel: parent });
      continue;
    }

    throw new EmailRenderError(template, 'render_failed');
  }
};
