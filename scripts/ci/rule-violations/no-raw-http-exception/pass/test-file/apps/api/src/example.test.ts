import { HTTPException } from 'hono/http-exception';

export const throwPlain = () => {
  throw new HTTPException(409, { message: 'A library threw this' });
};
