export const lastSeen = (db, userId: string) => db.session.findFirst({ where: { userId } });
