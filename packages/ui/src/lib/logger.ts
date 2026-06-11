/**
 * @atlas
 * @partOf primitive:ui
 */
import { createFrontendLogger, FrontendScope } from './frontendLogger';

export const log = createFrontendLogger(FrontendScope.ui);
