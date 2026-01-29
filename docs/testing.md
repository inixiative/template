# Testing

## Running Tests

```bash
# Run all tests
bun test

# Run tests for a specific package
bun run --filter=api test
bun run --filter=@template/db test
```

## Environment Composition

Each package's test script uses the `with` script to load environment variables:

```json
"test": "bun run --cwd ../.. with test api bun test"
```

This pattern ensures tests run with the correct `.env.test` files loaded. The `with` script:
1. Loads `$ROOT/.env.test` (shared test config)
2. Loads `$APP_DIR/.env.test` (app-specific test config)
3. Executes the test command

When adding a new package with tests, follow this pattern in its `package.json`.

## Test Files

- `.env.test` - Root-level shared test environment
- `apps/api/.env.test` - API-specific test environment (includes DATABASE_URL, REDIS_URL, etc.)

## Factories

TODO: Document test factories

## Mocks

TODO: Document mock setup (ioredis-mock, etc.)
