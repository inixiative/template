// Registry of operation ids (queryKey[0]._id) with a realtime producer. The FE pipes every query
// through addLiveQuery, which early-returns unless its _id is in here — so this is the single on/off
// switch for what's live. Mirrors the appEvent websocket reaches.
export const LIVE_QUERIES = new Set<string>(['inquiryRead']);
