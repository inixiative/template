/**
 * @atlas
 * @kind route
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { inquiryInfoResponseSchema } from '#/modules/inquiry/schemas/inquiryInfoResponseSchema';
import { Modules } from '#/modules/modules';

export const inquiryInfoRoute = readRoute({
  model: Modules.inquiry,
  action: 'info',
  skipId: true,
  responseSchema: inquiryInfoResponseSchema,
  description:
    'Lists every inquiry type: the source and target models it accepts (`targetModel` must be one of `targets`), the JSON Schema of its `content`, the extra fields its resolve body accepts (`resolutionInput`), the stored `resolution`, its uniqueness rule and default expiry. Public endpoint.',
});
