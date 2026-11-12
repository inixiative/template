import { beforeEach, describe, expect, it } from 'bun:test';
import { z } from '@hono/zod-openapi';
import type { Inquiry, User } from '@template/db/generated/client/client';
import { InquiryResourceModel, InquiryStatus } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { createInquiry, createUser } from '@template/db/test';
import { paginate } from '#/lib/prisma/paginate';
import { readRoute } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import { createTestApp } from '#tests/createTestApp';
import { get, json, jsonError } from '#tests/utils/request';

const route = readRoute({
  model: Modules.inquiry,
  action: 'enumFilterProbe',
  skipId: true,
  many: true,
  paginate: true,
  filterLens: {
    parent: lensFor('Inquiry'),
    root: {
      picks: ['status'],
      enumOmits: { status: [InquiryStatus.draft, InquiryStatus.canceled] },
    },
  },
  responseSchema: z.object({ id: z.string(), status: z.string() }),
});

describe('paginate — enum values in searchFields honour the filter lens', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let source: User;
  let sent: Inquiry;

  beforeEach(async () => {
    const { entity: user } = await createUser();
    source = user;
    const { entity: inquiry } = await createInquiry({
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.User,
      sourceUserId: source.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: source.id,
    });
    sent = inquiry;

    const controller = makeController(route, async (c, respond) => {
      const { data, pagination } = await paginate(c, c.get('db').inquiry, {
        where: { sourceUserId: source.id },
      });
      return respond.ok(
        data.map(({ id, status }) => ({ id, status })),
        { pagination },
      );
    });
    ({ fetch } = createTestApp({ mount: [(app) => app.openapi(route, controller)] }));
  });

  it('filters on an allowed enum value', async () => {
    const response = await fetch(get('/enumFilterProbe?searchFields[status][in]=sent'));

    expect(response.status).toBe(200);
    const body = await json<{ id: string; status: string }[]>(response);
    expect(body.data).toEqual([{ id: sent.id, status: InquiryStatus.sent }]);
  });

  it('rejects an enum value the lens omits, via an operator', async () => {
    const response = await fetch(get('/enumFilterProbe?searchFields[status][in]=draft'));

    expect(response.status).toBe(400);
    expect((await jsonError(response)).message).toContain(
      "Value 'draft' is not valid for field 'status'",
    );
  });

  it('rejects a value outside the enum with a 400, not a Prisma 500', async () => {
    const response = await fetch(get('/enumFilterProbe?searchFields[status][in]=bogus'));

    expect(response.status).toBe(400);
    expect((await jsonError(response)).message).toContain(
      "Value 'bogus' is not valid for field 'status'",
    );
  });

  it('rejects a bare enum value the lens omits', async () => {
    const response = await fetch(get('/enumFilterProbe?searchFields[status]=canceled'));

    expect(response.status).toBe(400);
    expect((await jsonError(response)).message).toContain(
      "Value 'canceled' is not valid for field 'status'",
    );
  });
});
