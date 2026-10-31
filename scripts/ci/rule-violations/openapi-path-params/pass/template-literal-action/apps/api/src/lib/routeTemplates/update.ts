export const routePath = (action?: string) => (action ? `/{id}/${action}` : '/{id}');
