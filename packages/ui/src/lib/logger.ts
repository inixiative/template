/**
 * @atlas
 * @kind adapter
 * @partOf primitive:ui
 * @uses none
 */
import { createFrontendLogger, FrontendScope } from './frontendLogger';

export const log = createFrontendLogger(FrontendScope.ui);
