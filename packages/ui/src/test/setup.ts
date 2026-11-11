/**
 * @atlas
 * @partOf primitive:ui
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

// The store and its slices import each other; like the apps, tests must enter through the store.
await import('@template/ui/store');
