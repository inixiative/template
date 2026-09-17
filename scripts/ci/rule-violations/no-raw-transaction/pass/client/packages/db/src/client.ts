// db.txn is built on top of the raw client's $transaction here — the one allowed call site.
export const dbMethods = {
  txn: async (fn: () => Promise<unknown>) => db.raw.$transaction(async () => fn()),
};
