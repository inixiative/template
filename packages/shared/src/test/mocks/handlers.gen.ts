import { http, HttpResponse } from 'msw';
import { buildUser, buildOrganizationUser, buildSpaceUser } from '@template/db/test';

// Auto-generated MSW handlers from SDK
//
// To customize a handler:
// 1. Find the endpoint below
// 2. Replace the default response with factory data
// 3. Add your custom logic
//
// Example:
// http.get('*/api/v1/me', () => {
//   const user = buildUser({ platformRole: 'user' });
//   return HttpResponse.json({ data: user });
// }),

export const handlers = [
  // POST /api/admin/cache/clear (adminCacheClear)
  http.post('*/api/admin/cache/clear', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/admin/cronJob (adminCronJobReadMany)
  http.get('*/api/admin/cronJob', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/admin/cronJob (adminCronJobCreate)
  http.post('*/api/admin/cronJob', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // DELETE /api/admin/cronJob/:id (adminCronJobDelete)
  http.delete('*/api/admin/cronJob/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/admin/cronJob/:id (adminCronJobRead)
  http.get('*/api/admin/cronJob/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // PATCH /api/admin/cronJob/:id (adminCronJobUpdate)
  http.patch('*/api/admin/cronJob/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/admin/cronJob/:id/trigger (adminCronJobTrigger)
  http.post('*/api/admin/cronJob/:id/trigger', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/admin/job (adminJobCreate)
  http.post('*/api/admin/job', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/admin/inquiry (adminInquiryReadMany)
  http.get('*/api/admin/inquiry', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/admin/organization (adminOrganizationReadMany)
  http.get('*/api/admin/organization', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/admin/space (adminSpaceReadMany)
  http.get('*/api/admin/space', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/admin/webhookSubscription (adminWebhookSubscriptionReadMany)
  http.get('*/api/admin/webhookSubscription', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/me (meRead)
  http.get('*/api/v1/me', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/me/organizations (meReadManyOrganizations)
  http.get('*/api/v1/me/organizations', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/me/spaces (meReadManySpaces)
  http.get('*/api/v1/me/spaces', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/me/providers (meReadManyProviders)
  http.get('*/api/v1/me/providers', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/me/tokens (meReadManyTokens)
  http.get('*/api/v1/me/tokens', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/me/tokens (meCreateToken)
  http.post('*/api/v1/me/tokens', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/me/webhookSubscriptions (meReadManyWebhookSubscriptions)
  http.get('*/api/v1/me/webhookSubscriptions', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/me/webhookSubscriptions (meCreateWebhookSubscription)
  http.post('*/api/v1/me/webhookSubscriptions', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/me/redact (meRedact)
  http.post('*/api/v1/me/redact', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/organization (organizationCreate)
  http.post('*/api/v1/organization', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // DELETE /api/v1/organization/:id (organizationDelete)
  http.delete('*/api/v1/organization/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/organization/:id (organizationRead)
  http.get('*/api/v1/organization/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // PATCH /api/v1/organization/:id (organizationUpdate)
  http.patch('*/api/v1/organization/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/organization/:id/protected (organizationProtected)
  http.get('*/api/v1/organization/:id/protected', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/organization/:id/tokens (organizationReadManyTokens)
  http.get('*/api/v1/organization/:id/tokens', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/organization/:id/tokens (organizationCreateToken)
  http.post('*/api/v1/organization/:id/tokens', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/organization/:id/webhookSubscriptions (organizationReadManyWebhookSubscriptions)
  http.get('*/api/v1/organization/:id/webhookSubscriptions', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/organization/:id/webhookSubscriptions (organizationCreateWebhookSubscription)
  http.post('*/api/v1/organization/:id/webhookSubscriptions', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/organization/:id/organizationUsers (organizationCreateOrganizationUser)
  http.post('*/api/v1/organization/:id/organizationUsers', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/organization/:id/users (organizationReadManyUsers)
  http.get('*/api/v1/organization/:id/users', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/organization/:id/spaces (organizationReadManySpaces)
  http.get('*/api/v1/organization/:id/spaces', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // DELETE /api/v1/organizationUser/:id (organizationUserDelete)
  http.delete('*/api/v1/organizationUser/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/organizationUser/:id (organizationUserRead)
  http.get('*/api/v1/organizationUser/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // PATCH /api/v1/organizationUser/:id (organizationUserUpdate)
  http.patch('*/api/v1/organizationUser/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/organizationUser/:id/tokens (organizationUserCreateToken)
  http.post('*/api/v1/organizationUser/:id/tokens', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // DELETE /api/v1/space/:id (spaceDelete)
  http.delete('*/api/v1/space/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/space/:id (spaceRead)
  http.get('*/api/v1/space/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // PATCH /api/v1/space/:id (spaceUpdate)
  http.patch('*/api/v1/space/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/space/:id/protected (spaceProtected)
  http.get('*/api/v1/space/:id/protected', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/space/:id/spaceUsers (spaceReadManySpaceUsers)
  http.get('*/api/v1/space/:id/spaceUsers', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/space/:id/tokens (spaceReadManyTokens)
  http.get('*/api/v1/space/:id/tokens', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/space/:id/tokens (spaceCreateToken)
  http.post('*/api/v1/space/:id/tokens', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/space/:id/customers (spaceReadManyCustomers)
  http.get('*/api/v1/space/:id/customers', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // DELETE /api/v1/spaceUser/:id (spaceUserDelete)
  http.delete('*/api/v1/spaceUser/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/spaceUser/:id (spaceUserRead)
  http.get('*/api/v1/spaceUser/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // PATCH /api/v1/spaceUser/:id (spaceUserUpdate)
  http.patch('*/api/v1/spaceUser/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/spaceUser/:id/tokens (spaceUserCreateToken)
  http.post('*/api/v1/spaceUser/:id/tokens', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // DELETE /api/v1/token/:id (tokenDelete)
  http.delete('*/api/v1/token/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/inquiry (inquiryCreate)
  http.post('*/api/v1/inquiry', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // DELETE /api/v1/inquiry/:id (inquiryDelete)
  http.delete('*/api/v1/inquiry/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/inquiry/:id (inquiryRead)
  http.get('*/api/v1/inquiry/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // PATCH /api/v1/inquiry/:id (inquiryUpdate)
  http.patch('*/api/v1/inquiry/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/inquiry/sent (inquirySentMany)
  http.get('*/api/v1/inquiry/sent', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/inquiry/received (inquiryReceivedMany)
  http.get('*/api/v1/inquiry/received', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/inquiry/:id/send (inquirySend)
  http.post('*/api/v1/inquiry/:id/send', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // POST /api/v1/inquiry/:id/resolve (inquiryResolve)
  http.post('*/api/v1/inquiry/:id/resolve', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/webhookSubscription/info (webhookSubscriptionInfo)
  http.get('*/api/v1/webhookSubscription/info', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // DELETE /api/v1/webhookSubscription/:id (webhookSubscriptionDelete)
  http.delete('*/api/v1/webhookSubscription/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // GET /api/v1/webhookSubscription/:id (webhookSubscriptionRead)
  http.get('*/api/v1/webhookSubscription/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
  // PATCH /api/v1/webhookSubscription/:id (webhookSubscriptionUpdate)
  http.patch('*/api/v1/webhookSubscription/:id', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),
];
