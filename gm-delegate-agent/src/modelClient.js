// modelClient.js — one interface, config per subagent (spec §1.5/§5.1).
// Every model call goes through an OpenAI-compatible /v1/chat/completions
// endpoint so swapping a subagent to Claude behind a shim is a config edit,
// not a code edit. Out of scope for M5 (per the M5 briefing: "any actual
// prompting of a model with a real task" is M6+) — this exists because the
// Build section lists it as one of the two things M5 stands up, but nothing
// calls it yet.

export class ModelClient {
  #models;

  constructor(config) {
    this.#models = config.models;
  }

  // subagentKey selects the config block (e.g. "classifier", "encounter").
  // tools is optional — passed through verbatim in OpenAI tool-calling shape
  // (contracts/tools.json, §5.2) when the caller has a tool surface to offer.
  async chatComplete(subagentKey, { messages, tools } = {}) {
    const cfg = this.#models[subagentKey];
    if (!cfg) throw new Error(`ModelClient: no config for subagent "${subagentKey}"`);

    const body = { model: cfg.model, max_tokens: cfg.max_tokens, messages };
    if (tools) body.tools = tools;

    const res = await fetch(`${cfg.endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`ModelClient: "${subagentKey}" endpoint ${cfg.endpoint} returned ${res.status}`);
    }
    return res.json();
  }
}
