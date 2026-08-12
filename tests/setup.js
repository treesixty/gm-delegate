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
  // socket.js reads game.modules.get(MODULE_ID).version for its HELLO frame.
  modules: new Map([["gm-delegate", { version: "0.0.0-test" }]]),
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

// on()/callAll() actually dispatch (a plain vi.fn() spy can't exercise
// eventbus.js's registerHooks(), which needs to call back into real
// handlers). once() stays a spy — nothing under test relies on init/ready
// firing.
const hookHandlers = new Map();
globalThis.Hooks = {
  once: vi.fn(),
  on: vi.fn((name, fn) => {
    if (!hookHandlers.has(name)) hookHandlers.set(name, []);
    hookHandlers.get(name).push(fn);
  }),
  callAll: vi.fn((name, ...args) => {
    for (const fn of hookHandlers.get(name) ?? []) fn(...args);
  }),
};
globalThis.ChatMessage = { deleteDocuments: vi.fn(async () => []) };
globalThis.Roll = { fromJSON: vi.fn((json) => JSON.parse(json)) };

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
  hookHandlers.clear();
}
