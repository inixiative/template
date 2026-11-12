import { describe, expect, it } from 'bun:test';
import { schemaGuide } from '#/lib/jsonSchema/schemaGuide';
import { contactInfoResponseSchema } from '#/modules/contact/schemas/contactInfoResponseSchema';
import { inquiryInfoResponseSchema } from '#/modules/inquiry/schemas/inquiryInfoResponseSchema';
import { segmentInfoResponseSchema } from '#/modules/segment/schemas/segmentInfoResponseSchema';
import { webhookSubscriptionInfoResponseSchema } from '#/modules/webhookSubscription/schemas/webhookSubscriptionInfoResponseSchema';

const infoResponseSchemas = {
  contact: contactInfoResponseSchema,
  inquiry: inquiryInfoResponseSchema,
  segment: segmentInfoResponseSchema,
  webhookSubscription: webhookSubscriptionInfoResponseSchema,
};

describe('schemaGuide', () => {
  it('keys every property by its dotted path, through records and arrays', () => {
    const guide = schemaGuide(contactInfoResponseSchema);
    expect(guide['types.*.subtype.mode']).toContain('subtype');
    expect(schemaGuide(segmentInfoResponseSchema)['types.fields[].path']).toContain('root');
  });

  for (const [module, schema] of Object.entries(infoResponseSchemas))
    it(`describes every key of /${module}/info`, () => {
      const undescribed = Object.entries(schemaGuide(schema)).filter(([, text]) => !text);
      expect(undescribed).toEqual([]);
    });
});
