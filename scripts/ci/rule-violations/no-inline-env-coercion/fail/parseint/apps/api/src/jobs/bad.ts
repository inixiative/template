export const bad = () => {
  const days = Number.parseInt(process.env.RETENTION_DAYS ?? '90', 10);
  return days;
};
