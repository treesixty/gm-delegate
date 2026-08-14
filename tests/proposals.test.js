// proposals.js (spec §5.7): put/get/markOpened/sweepExpired, three genuinely
// distinct states — never opened (expired -> negative), opened then skipped
// (weak negative, panel.js's job), accepted or edited (positive, panel.js's
// job). This file only proves the store itself: TTL, the never-opened ->
// expired label, and that markOpened is what keeps skip and expired apart.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetFoundry } from "./setup.js";
import { registerJournalSettings, getCardLog, logCard } from "../scripts/journal.js";
import {
  put,
  get,
  getEntry,
  markOpened,
  remove,
  sweepExpired,
  registerCardLogger,
  _resetForTests,
} from "../scripts/proposals.js";

const proposal = (over = {}) => ({
  subsystem: "random_encounters",
  creatures: [{ name: "Wolf Pack", quantity: 5, packId: "dnd5e.monsters", actorId: "wolf1" }],
  beats: ["Sound first: whining.", "They circle.", "Leader hangs back."],
  hook: "Something worse drove them out of the deep wood.",
  provenance: { tableId: "RollTable.abc", roll: 14, result: "Wolf Pack" },
  ...over,
});

beforeEach(() => {
  resetFoundry();
  registerJournalSettings();
  registerCardLogger(logCard);
  _resetForTests();
  vi.useRealTimers();
});

describe("proposals.js — put/get (§5.7)", () => {
  it("put() fills id/created_ts/expires_ts/opened and get() returns the full record", () => {
    const record = put(proposal());
    expect(record.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(record.opened).toBe(false);
    expect(record.expires_ts).toBe(record.created_ts + 15 * 60 * 1000);

    expect(get(record.id)).toEqual(record);
  });

  it("get() returns null for an absent id", () => {
    expect(get("nonexistent")).toBeNull();
  });

  it("get() returns null once past expires_ts, without deleting or logging (lazy, no side effect)", async () => {
    vi.useFakeTimers();
    const record = put(proposal());
    vi.setSystemTime(record.expires_ts + 1);

    expect(get(record.id)).toBeNull();
    expect(getCardLog()).toHaveLength(0); // a lazy read must not itself emit the expired label
  });
});

describe("proposals.js — markOpened (§5.7, skip vs expired)", () => {
  it("distinguishes opened from never-opened", () => {
    const record = put(proposal());
    expect(get(record.id).opened).toBe(false);
    markOpened(record.id);
    expect(get(record.id).opened).toBe(true);
  });

  it("is a no-op for an absent or already-expired id", () => {
    vi.useFakeTimers();
    const record = put(proposal());
    vi.setSystemTime(record.expires_ts + 1);
    expect(() => markOpened(record.id)).not.toThrow();
    expect(() => markOpened("nonexistent")).not.toThrow();
  });
});

describe("proposals.js — remove()", () => {
  it("makes a subsequent get() return null (place_encounter's single-use consumption)", () => {
    const record = put(proposal());
    remove(record.id);
    expect(get(record.id)).toBeNull();
  });
});

describe("proposals.js — sweepExpired (§5.7, the labelling event)", () => {
  it("logs gm_action 'expired' for an unopened proposal past its TTL, then removes it", async () => {
    vi.useFakeTimers();
    const record = put(proposal(), { trigger: { type: "gm_command", text: "test" } });
    vi.setSystemTime(record.expires_ts + 1);

    const ids = await sweepExpired();
    expect(ids).toEqual([record.id]);

    const card = getCardLog().at(-1);
    expect(card).toMatchObject({
      proposal_id: record.id,
      subsystem: "random_encounters",
      mode: "propose",
      gm_action: "expired",
    });
    expect(get(record.id)).toBeNull();
  });

  it("does not log or touch an opened proposal even past its TTL", async () => {
    vi.useFakeTimers();
    const record = put(proposal());
    markOpened(record.id);
    vi.setSystemTime(record.expires_ts + 1);

    const ids = await sweepExpired();
    expect(ids).toEqual([]);
    expect(getCardLog()).toHaveLength(0);
  });

  it("leaves an unexpired proposal alone", async () => {
    const record = put(proposal());
    const ids = await sweepExpired();
    expect(ids).toEqual([]);
    expect(get(record.id)).not.toBeNull();
  });
});

describe("proposals.js — getEntry (internal, panel.js's accept/edit/reroll/skip need cardLogContext too)", () => {
  it("returns { proposal, cardLogContext } together", () => {
    const context = { trigger: { type: "gm_command", text: "x" }, model: "qwen3.5-9b-q4km" };
    const record = put(proposal(), context);
    const entry = getEntry(record.id);
    expect(entry.proposal).toEqual(record);
    expect(entry.cardLogContext).toEqual(context);
  });
});
