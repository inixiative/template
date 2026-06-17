/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import {
  type ComposeContext,
  composeTemplate,
  EmailRenderError,
  interpolate,
  parentOwner,
  type RuleErrorSink,
  type Variables,
} from '@template/email/render';
import { LogScope, log } from '@template/shared/logger';
import type { ReachContext } from '#/lib/audience';

export const composeCtx = (ctx: ReachContext): ComposeContext => ({
  locale: 'en',
  ownerModel: ctx.ownerModel,
  organizationId: ctx.ownerModel === 'Organization' ? ctx.organizationId : undefined,
  spaceId: ctx.ownerModel === 'Space' ? ctx.spaceId : undefined,
});

export type SettledTemplate = { subject: string; mjml: string };

// settle = f(template, context, data) → deliverable subject + mjml. Compose at the context owner,
// interpolate, then apply the resolved template's render-error policy: degrade (drop the bad
// block), fallback (re-compose one owner up the cascade), or fail (throw → DLQ). Shared so the
// deliver job owns the whole resolve-and-render step — the planner only routes the template name.
export const settleTemplate = async (
  template: string,
  context: ReachContext,
  data: Variables,
): Promise<SettledTemplate> => {
  let composed = await composeTemplate(template, composeCtx(context));

  while (true) {
    const errors: string[] = [];
    const onError: RuleErrorSink = (message) => errors.push(message);
    const mjml = interpolate(composed.mjml, data, onError);
    const subject = interpolate(composed.subject, data, onError);

    if (!errors.length) return { subject, mjml };

    log.warn(
      `Email render error: template=${template} owner=${composed.ownerModel} — ${[...new Set(errors)].join('; ')}`,
      LogScope.email,
    );

    const parent = parentOwner(composed.ownerModel);
    const policy = parent ? composed.onError : 'fail';

    if (policy === 'degrade') return { subject, mjml };
    if (policy === 'fallback' && parent) {
      composed = await composeTemplate(template, { ...composeCtx(context), ownerModel: parent });
      continue;
    }

    throw new EmailRenderError(template, 'render_failed');
  }
};
