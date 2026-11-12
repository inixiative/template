app.get('/api/v1/thing/:id', (c) => c.json({ route: c.req.routePath }));
