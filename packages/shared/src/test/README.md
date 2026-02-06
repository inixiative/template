# Frontend Testing with MSW

## Setup

MSW intercepts network requests at the service worker level - no function mocking needed!

```typescript
import '../test/setup'; // Auto-starts MSW server
import { buildUser } from '@template/db/test'; // Use factories for data
```

## Auto-Generated Handlers

MSW handlers are auto-generated from the SDK:

```bash
bun run generate:api  # Generates SDK + MSW handlers
```

This creates:
- `handlers.gen.ts` - All API endpoints (auto-generated, don't edit)
- `handlers.ts` - Custom overrides (edit this)

## Custom Handlers

Edit `src/test/mocks/handlers.ts` to override generated defaults:

```typescript
import { http, HttpResponse } from 'msw';
import { buildUser } from '@template/db/test';
import { handlers as generatedHandlers } from './handlers.gen';

const customHandlers = [
  // Override with realistic data
  http.get('*/api/v1/me', () => {
    const user = buildUser({ platformRole: 'superadmin' });
    return HttpResponse.json({ data: user });
  }),
];

// Custom handlers take precedence
export const handlers = [...customHandlers, ...generatedHandlers];
```

## Override in Tests

```typescript
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

it('handles errors', async () => {
  server.use(
    http.get('*/api/me', () => {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    })
  );

  await expect(fetchUser()).rejects.toThrow();
});
```

## Run Tests

```bash
cd packages/shared && bun test
cd packages/shared && bun test --watch
```

## Factory Examples

```typescript
import { buildUser, buildOrganization, buildSpace } from '@template/db/test';

// Simple
const user = buildUser();

// With overrides
const admin = buildUser({ platformRole: 'superadmin' });

// Related data
const org = buildOrganization();
const user = buildUser();
const orgUser = buildOrganizationUser({
  userId: user.id,
  organizationId: org.id,
  role: 'owner',
});
```

## Notes

- MSW runs in Node/Bun for tests (not browser)
- Use `build*()` factories for in-memory data (no DB)
- Use `create*()` factories only when you need DB persistence
- Import order matters: import test/setup before other code
