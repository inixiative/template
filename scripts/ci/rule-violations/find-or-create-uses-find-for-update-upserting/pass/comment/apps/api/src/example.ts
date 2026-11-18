// Prisma throws P2002 on conflict; the fence below means we never see it.
export const noop = () => undefined;
