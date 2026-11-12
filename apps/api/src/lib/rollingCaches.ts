/**
 * @atlas
 * @kind registry
 * @partOf primitive:caching, primitive:jobs
 * @uses infrastructure:redis
 */
// Every module that defines a rolling cache (`makeRollingCache(`) is imported here, import-only. A
// definition registers itself when its module loads, and the worker entry imports this barrel, so the
// coordinator sees every cache from the worker's first tick rather than only after some request happens
// to import its module. CI (scripts/ci/rules/rolling-cache-registered.sh) fails a definition missing
// from this list. Add `import '#/modules/<module>/<file>';` per definition.

export {};
