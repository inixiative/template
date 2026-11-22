const defineRegistry = <T,>(registry: T): T => registry;

export const PolymorphismRegistry = defineRegistry({
  Mention: { axes: [{ field: 'subjectModel', fkMap: { User: ['subjectUserId'] } }] },
});
