// config.js — loads config.yaml (spec §5.1).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(__dirname, "..", "config.yaml");

export function loadConfig(path = DEFAULT_PATH) {
  return parse(readFileSync(path, "utf8"));
}
