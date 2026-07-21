// The extension is the only place the raw bulk ops are issued (escaped, internally).
export async function internalWrite(delegate: { createMany: (a: unknown) => Promise<unknown> }) {
  await delegate.createMany({ data: [] });
}
