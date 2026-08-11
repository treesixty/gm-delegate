// Catches the class of bug that a 2026-08-10 spec renumber introduced and that
// nothing else would have caught: §6 and §7 were swapped in the spec, and every
// "Read: spec §7" line in docs/milestones/ silently began pointing at the wrong
// section. Nine references across four files were wrong and the build was green.
//
// Cross-references are the one thing a markdown spec cannot check for itself.
// This makes them checkable.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const specPath = path.join(root, "docs/gm-delegate-build-spec-v1.md");
const spec = fs.readFileSync(specPath, "utf8");

// Every "## N." and "### N.M" heading in the spec.
const headings = new Set(
  [...spec.matchAll(/^#{2,3} (\d+(?:\.\d+)?)\.? /gm)].map((m) => m[1])
);

const refsIn = (text) =>
  [...new Set([...text.matchAll(/§(\d+(?:\.\d+)?)/g)].map((m) => m[1]))];

function filesToCheck() {
  const out = [];
  const briefings = path.join(root, "docs/milestones");
  if (fs.existsSync(briefings)) {
    for (const f of fs.readdirSync(briefings).filter((f) => f.endsWith(".md"))) {
      out.push(path.join(briefings, f));
    }
  }
  for (const f of ["AGENTS.md", "CLAUDE.md", "STATUS.md"]) {
    const p = path.join(root, f);
    if (fs.existsSync(p)) out.push(p);
  }
  const scripts = path.join(root, "scripts");
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js")) out.push(p);
    }
  };
  if (fs.existsSync(scripts)) walk(scripts);
  return out;
}

describe("spec cross-references resolve", () => {
  it("finds headings in the spec at all", () => {
    expect(headings.size).toBeGreaterThan(20);
  });

  it("has no dangling § reference inside the spec itself", () => {
    const bad = refsIn(spec).filter((r) => !headings.has(r));
    expect(bad, `spec references sections that do not exist: ${bad.join(", ")}`).toEqual([]);
  });

  for (const file of filesToCheck()) {
    const rel = path.relative(root, file);
    it(`has no dangling § reference in ${rel}`, () => {
      const text = fs.readFileSync(file, "utf8");
      const bad = refsIn(text).filter((r) => !headings.has(r));
      expect(bad, `${rel} points at missing spec sections: ${bad.join(", ")}`).toEqual([]);
    });
  }
});

describe("milestone briefings agree with §8's index", () => {
  // §8's index is the canonical milestone -> sections map. Each briefing also
  // carries a "Read:" line. Two copies drift; this keeps them honest without
  // forcing either to be deleted.
  // Parse ONLY the marked index table. Without the markers the milestone table
  // below it also matches, which produced duplicate rows for 5a and 9.
  const block = spec.split("<!-- INDEX:BEGIN -->")[1]?.split("<!-- INDEX:END -->")[0] ?? "";
  const indexRows = [...block.matchAll(/^\| (\d+a?) \| ([^|]*§[^|]*) \|/gm)].map((m) => ({
    milestone: m[1],
    sections: refsIn(m[2])
  }));

  it("parses the §8 index", () => {
    expect(indexRows.length).toBeGreaterThan(5);
  });

  const briefings = path.join(root, "docs/milestones");
  const files = fs.existsSync(briefings)
    ? fs.readdirSync(briefings).filter((f) => f.endsWith(".md"))
    : [];

  for (const f of files) {
    const m = f.match(/^(\d+a?)-/);
    if (!m) continue;
    const milestone = m[1].replace(/^0+(?=\d)/, "");   // "05a" -> "5a", "01" -> "1"
    it(`${f} "Read:" line is covered by §8's row for M${milestone}`, () => {
      const text = fs.readFileSync(path.join(briefings, f), "utf8");
      const readLine = text.split("\n").find((l) => l.startsWith("**Read:**"));
      expect(readLine, `${f} has no **Read:** line`).toBeTruthy();
      const row = indexRows.find((r) => r.milestone === milestone);
      expect(row, `§8 index has no row for M${milestone}`).toBeTruthy();
      const missing = refsIn(readLine).filter((s) => !row.sections.includes(s));
      expect(
        missing,
        `${f} tells the agent to read §${missing.join(", §")}, which §8's M${milestone} row omits`
      ).toEqual([]);
    });
  }
});
