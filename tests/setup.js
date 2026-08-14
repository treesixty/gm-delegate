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
  // M6 (§5.2): random_encounters' tools read these. `contents`/`get` mirror
  // the actors mock's shape; individual test files set return values.
  tables: { contents: [], get: vi.fn(() => null) },
  packs: { get: vi.fn(() => null) },
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
  }),
});

// canvas.scene.createEmbeddedDocuments (M7, §5.2's place_encounter — not the
// interactive canvas.tokens.placeTokens(), which waits on a real canvas
// click and never resolves headlessly) defaults to handing back each input
// doc with a synthetic id/uuid and a working toObject() — real enough for
// encounter.test.js's dedupe/undo-shape assertions without pretending to be
// Foundry's actual placement algorithm.
globalThis.canvas = {
  tokens: layer(),
  scene: {
    createEmbeddedDocuments: vi.fn(async (_type, data) =>
      [...data].map((d, i) => {
        const doc = { ...d, _id: `placed${i}`, id: `placed${i}`, uuid: `Token.placed${i}` };
        doc.toObject = () => ({ ...doc });
        return doc;
      })
    ),
    dimensions: { sceneRect: { x: 0, y: 0, width: 1000, height: 1000 } },
  },
  grid: { size: 100 },
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

// A constructor (encounter.js's resolveInlineFormulas does `new Roll(formula)`,
// M6 §5.2), not just the static fromJSON eventbus.js already needed. Default
// evaluate() is deterministic (sum of the max face implied by "NdM", or 0 for
// a flat formula like "1") so tests are reproducible without per-test mocking;
// override via vi.spyOn(Roll.prototype, "evaluate") when a test needs a
// specific total.
function RollMock(formula) {
  this.formula = formula;
  this.total = undefined;
}
RollMock.prototype.evaluate = vi.fn(async function () {
  const m = this.formula.match(/^(\d+)d(\d+)$/);
  this.total = m ? Number(m[1]) * Number(m[2]) : Number(this.formula) || 0;
  return this;
});
RollMock.fromJSON = vi.fn((json) => JSON.parse(json));
globalThis.Roll = RollMock;

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
