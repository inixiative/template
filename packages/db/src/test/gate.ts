/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
// A promise a test opens by hand, to hold one side of a race at a chosen point.
export const gate = (): { open: () => void; opened: Promise<void> } => {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
};
