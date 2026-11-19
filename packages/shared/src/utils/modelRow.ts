/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */

export type ModelRow<Model extends string = string> = { model: Model; id: string };
