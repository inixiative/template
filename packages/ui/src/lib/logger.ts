import { createFrontendLogger, FrontendScope } from './frontendLogger';

export const log = createFrontendLogger(FrontendScope.ui);
