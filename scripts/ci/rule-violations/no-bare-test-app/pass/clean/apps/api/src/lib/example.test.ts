import { createTestApp } from '#tests/createTestApp';

const { fetch } = createTestApp({ mount: [(app) => app.get('/ok', (c) => c.json({ ok: true }))] });
