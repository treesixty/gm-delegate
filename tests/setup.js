// Foundry globals, mocked just enough that pure logic imports without a browser.
//
// Deliberately minimal. This is not a Foundry emulator and must not grow into
// one: anything that genuinely needs Foundry belongs in the in-Foundry path
// (game.modules.get("gm-delegate").api from the console), not here. If a test
// starts needing a real document lifecycle, that is the signal it is an
// integration check, not a unit test.

import { vi } from "vitest";

const settings = new Map();

globalThis.game = {
  settings: {
    register(module, key, cfg) {
      settings.set(`${module}.${key}`, structuredClone(cfg.default));
    },
    get(module, key) {
      return settings.get(`${module}.${key}`);
    },
    async set(module, key, value) {
      settings.set(`${module}.${key}`, structuredClone(value));
      return value;
    }
  },
  actors: {
    get: vi.fn(() => null),
    find: vi.fn(() => null),
    importFromCompendium: vi.fn()
  },
  modules: new Map(),
  user: { isGM: true }
};

// Layer history is an array so §4.5's idempotency guard can be exercised:
// push a fake "create" entry and commit() should decline to record a second.
const layer = () => ({
  history: [],
  storeHistory: vi.fn(function (type, data) {
    this.history.push({ type, data });
  }),
  undoHistory: vi.fn(async function () {
    return this.history.pop();
  })
});

globalThis.canvas = {
  tokens: layer(),
  scene: { createEmbeddedDocuments: vi.fn(async (_t, docs) => docs) },
  level: { id: "level-0" }
};

globalThis.fromUuid = vi.fn(async () => null);
globalThis.Hooks = { once: vi.fn(), on: vi.fn(), callAll: vi.fn() };
globalThis.ChatMessage = { deleteDocuments: vi.fn(async () => []) };

globalThis.foundry = {
  utils: {
    deepClone: (v) => structuredClone(v),
    mergeObject: (a, b) => ({ ...a, ...b })
  }
};

// Reset mutable state between files so ordering cannot create false passes.
export function resetFoundry() {
  settings.clear();
  globalThis.canvas.tokens = layer();
}
