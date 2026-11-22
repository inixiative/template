import { describe, expect, it } from 'bun:test';
import { descriptionsBySchemaFieldPath } from '#/lib/jsonSchema/descriptionsBySchemaFieldPath';
import { contactInfoResponseSchema } from '#/modules/contact/schemas/contactInfoResponseSchema';
import { inquiryInfoResponseSchema } from '#/modules/inquiry/schemas/inquiryInfoResponseSchema';
import { segmentInfoResponseSchema } from '#/modules/segment/schemas/segmentInfoResponseSchema';
import { settingInfoResponseSchema } from '#/modules/setting/schemas/settingInfoResponseSchema';
import { webhookSubscriptionInfoResponseSchema } from '#/modules/webhookSubscription/schemas/webhookSubscriptionInfoResponseSchema';

const infoResponseSchemas = {
  contact: contactInfoResponseSchema,
  inquiry: inquiryInfoResponseSchema,
  segment: segmentInfoResponseSchema,
  setting: settingInfoResponseSchema,
  webhookSubscription: webhookSubscriptionInfoResponseSchema,
};

describe('descriptionsBySchemaFieldPath', () => {
  it('keys every property by its dotted path, through records and arrays', () => {
    const guide = descriptionsBySchemaFieldPath(contactInfoResponseSchema);
    expect(guide['types.*.subtype.mode']).toContain('subtype');
    expect(
      descriptionsBySchemaFieldPath(segmentInfoResponseSchema)['types.fields[].path'],
    ).toContain('root');
  });

  for (const [module, schema] of Object.entries(infoResponseSchemas))
    it(`describes every key of /${module}/info`, () => {
      const undescribed = Object.entries(descriptionsBySchemaFieldPath(schema)).filter(
        ([, text]) => !text,
      );
      expect(undescribed).toEqual([]);
    });
});
