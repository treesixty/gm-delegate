import { describe, it, expect } from "vitest";
import { ulid } from "../src/ulid.js";

describe("ulid", () => {
  it("produces a 26-char Crockford base32 string matching contracts/envelope.schema.json's id pattern", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("two calls in the same tick still differ (random suffix)", () => {
    expect(ulid()).not.toBe(ulid());
  });

  it("is lexicographically sortable by time for a fixed clock (deterministic prefix)", () => {
    const early = ulid(1_000_000);
    const late = ulid(2_000_000);
    expect(early.slice(0, 10) < late.slice(0, 10)).toBe(true);
  });
});
