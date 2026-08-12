// ulid.js — dependency-free ULID generator, spec §5.6 ("id — ULID, generated
// by the sender"). Verbatim duplicate of scripts/ulid.js (the Foundry
// module's copy) — there is no shared module boundary between the browser
// and this Node process to put a single copy in, and the algorithm is small
// enough that hand-duplicating it once beats a workspace/monorepo package
// split for two ~25-line files.
//
// Crockford's base32 (excludes I, L, O, U), matching
// ../../contracts/envelope.schema.json's `id` pattern:
// ^[0-9A-HJKMNP-TV-Z]{26}$. 10 timestamp chars (48-bit ms) + 16 random chars.

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomChar() {
  const bytes = new Uint8Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return ENCODING[bytes[0] % 32]; // 256 % 32 === 0, no modulo bias
}

export function ulid(time = Date.now()) {
  let t = time;
  let timeChars = "";
  for (let i = 0; i < 10; i++) {
    timeChars = ENCODING[t % 32] + timeChars;
    t = Math.floor(t / 32);
  }
  let randChars = "";
  for (let i = 0; i < 16; i++) randChars += randomChar();
  return timeChars + randChars;
}
