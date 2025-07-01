export const usersUpdateCurrent = async ({ db, user, body, error }) => {
  if (!user) return error(401, { error: 'Unauthorized' });
  
  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: body
  });
  
  return updatedUser;
};