import { handlers } from '@template/shared/test/mocks/handlers';
import { setupServer } from 'msw/native';

export const server: ReturnType<typeof setupServer> = setupServer(...handlers);
