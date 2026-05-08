// Reads a value the schema has already coerced/defaulted — no inline casting.
export const example = () => {
  const days = process.env.INACTIVITY_THRESHOLD_DAYS;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
};
