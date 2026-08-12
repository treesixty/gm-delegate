// panel.js — THROWAWAY STUB for M2. The real ApplicationV2 GM panel is M3
// (spec §4.7). This exists only so interceptor.js has something to call for
// `propose` mode. Do not build the Panel UI here to satisfy M2.

const queued = [];

export const Panel = {
  queue(intent) {
    queued.push(intent);
    console.log("gm-delegate | Panel.queue (stub) |", intent);
  },
  // Test/console introspection only; the real Panel (M3) renders from the
  // journal, not from this array.
  queued,
};
