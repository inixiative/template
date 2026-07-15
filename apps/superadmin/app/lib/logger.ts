/**
 * @atlas
 * @kind utils
 * @partOf superadmin
 * @uses primitive:ui
 */
import { createFrontendLogger, FrontendScope } from '@template/ui/lib/frontendLogger';

export const log = createFrontendLogger(FrontendScope.superadmin);
