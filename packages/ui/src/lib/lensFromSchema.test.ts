import { describe, expect, it } from 'bun:test';
import { InquiryItemSchema } from '@template/sdk/schemas.gen';
import { lensFromSchema, type SdkSchema } from '@template/ui/lib/lensFromSchema';

const RewardSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    itemTitle: { type: 'string' },
    pointsRequired: { type: 'integer' },
    price: { type: 'number' },
    isLevelReward: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    archivedAt: { type: ['string', 'null'], format: 'date-time' },
    rewardType: { type: 'string', enum: ['physical', 'digital', 'experience'] },
    statuses: { type: 'array', items: { type: 'string', enum: ['draft', 'live', null] } },
    config: {},
    brand: {
      type: ['object', 'null'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
    },
    redemptions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          redeemedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    tags: { type: 'array', items: { type: 'string' } },
  },
} as const satisfies SdkSchema;

describe('lensFromSchema', () => {
  const lens = lensFromSchema(RewardSchema, { model: 'Reward' });
  const fields = lens.maps.sdk.models.Reward.fields;

  it('anchors the lens at the given model', () => {
    expect(lens.mapName).toBe('sdk');
    expect(lens.model).toBe('Reward');
  });

  it('maps scalar types including date-time format', () => {
    expect(fields.itemTitle).toEqual({ kind: 'scalar', type: 'String' });
    expect(fields.pointsRequired).toEqual({ kind: 'scalar', type: 'Int' });
    expect(fields.price).toEqual({ kind: 'scalar', type: 'Float' });
    expect(fields.isLevelReward).toEqual({ kind: 'scalar', type: 'Boolean' });
    expect(fields.createdAt).toEqual({ kind: 'scalar', type: 'DateTime' });
  });

  it('strips null from nullable type unions', () => {
    expect(fields.archivedAt).toEqual({ kind: 'scalar', type: 'DateTime' });
  });

  it('maps enums with their allowed values', () => {
    expect(fields.rewardType).toEqual({
      kind: 'enum',
      type: 'Reward.rewardType',
      values: ['physical', 'digital', 'experience'],
    });
  });

  it('maps enum lists and drops null members from values', () => {
    expect(fields.statuses).toEqual({
      kind: 'enum',
      type: 'Reward.statuses',
      isList: true,
      values: ['draft', 'live'],
    });
  });

  it('maps untyped fields to Json', () => {
    expect(fields.config).toEqual({ kind: 'scalar', type: 'Json' });
  });

  it('maps nested objects to child models, stripping nullability', () => {
    expect(fields.brand).toEqual({ kind: 'object', type: 'Reward.brand' });
    expect(lens.maps.sdk.models['Reward.brand'].fields.name).toEqual({ kind: 'scalar', type: 'String' });
  });

  it('maps object arrays to isList relations', () => {
    expect(fields.redemptions).toEqual({ kind: 'object', type: 'Reward.redemptions', isList: true });
    expect(lens.maps.sdk.models['Reward.redemptions'].fields.redeemedAt).toEqual({
      kind: 'scalar',
      type: 'DateTime',
    });
  });

  it('maps scalar arrays to isList scalars', () => {
    expect(fields.tags).toEqual({ kind: 'scalar', type: 'String', isList: true });
  });

  it('unwraps a root array schema to its items', () => {
    const listLens = lensFromSchema({ type: 'array', items: RewardSchema } as const satisfies SdkSchema, {
      model: 'Reward',
    });
    expect(listLens.maps.sdk.models.Reward.fields.itemTitle).toEqual({ kind: 'scalar', type: 'String' });
  });

  it('builds from a real generated SDK schema', () => {
    const inquiryLens = lensFromSchema(InquiryItemSchema, { model: 'Inquiry' });
    const inquiryFields = inquiryLens.maps.sdk.models.Inquiry.fields;
    expect(inquiryFields.createdAt).toEqual({ kind: 'scalar', type: 'DateTime' });
    expect(inquiryFields.status.kind).toBe('enum');
    expect(inquiryFields.status.values).toContain('approved');
    expect(inquiryFields.sourceUser.kind).toBe('object');
  });
});
