// modelClient.js — one interface, config per subagent (spec §1.5/§5.1),
// backed by @earendil-works/pi-ai (2026-08-13 decision, STATUS.md) instead
// of a hand-rolled fetch().
//
// Reasoning is OFF (spec §2's original mandate: "reasoning is disabled by
// default... thinking tokens would blow the latency budget"). M5a/M6 ran
// with it left on by accident — llama-server was never told to disable it,
// and pi-ai's `thinkingFormat: "qwen"` sent the wrong wire field for
// llama-server anyway (a vLLM-shaped top-level `enable_thinking`, not
// llama-server's `--reasoning` flag), so the mandate was silently not in
// effect. Fixed 2026-08-13 (STATUS.md) after finding the model would loop
// calling `roll_on_table` repeatedly instead of stopping: llama-server now
// runs with `--reasoning off` server-side, confirmed live (no
// `reasoning_content` in a real response) — `reasoning: false` here matches
// that actual behavior rather than declaring a capability nothing invokes.
//
// Every model call still goes through this one interface, so swapping a
// subagent to a different provider stays a config edit — pi-ai's own
// createProvider()/Models collection is what actually makes that true now,
// not just a comment saying it should be.

import { createModels, createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

export class ModelClient {
  #models = createModels();
  #entries = {}; // subagentKey -> pi-ai Model

  constructor(config) {
    for (const [subagentKey, cfg] of Object.entries(config.models)) {
      const provider = createProvider({
        id: subagentKey,
        // llama-server takes no real API key (localhost-only trust, same
        // posture as the module's own agent socket, §5.6 rule 6) — but
        // pi-ai's `complete()` path requires a non-empty `apiKey` string
        // even when `getAuth()` itself accepts `{}` (confirmed live: `{}`
        // resolves fine from `getAuth()` but `complete()` fails with "No
        // API key for provider"). The dummy value is never checked server-side.
        auth: { apiKey: { name: subagentKey, resolve: async () => ({ auth: { apiKey: "not-needed" } }) } },
        models: [
          {
            id: cfg.model,
            name: cfg.model,
            api: "openai-completions",
            provider: subagentKey,
            baseUrl: cfg.endpoint,
            reasoning: false, // deliberately off server-side now (--reasoning off) — see file header
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192, // matches llama-server's -c 8192 this session actually started with
            maxTokens: cfg.max_tokens,
            // llama-server isn't in pi-ai's auto-detected OpenAI-compat list
            // (Cerebras, xAI, DeepSeek, ...) — same class of local server the
            // library's own docs call out by name (Ollama, vLLM, SGLang).
            compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
          },
        ],
        api: openAICompletionsApi(),
      });
      this.#models.setProvider(provider);
      this.#entries[subagentKey] = this.#models.getModel(subagentKey, cfg.model);
    }
  }

  // Returns pi-ai's AssistantMessage directly (content: (text|thinking|toolCall)[]) —
  // callers read content blocks, they don't parse raw OpenAI JSON or
  // JSON.parse() a tool_calls[].function.arguments string themselves.
  async chatComplete(subagentKey, { systemPrompt, messages, tools } = {}) {
    const model = this.#entries[subagentKey];
    if (!model) throw new Error(`ModelClient: no config for subagent "${subagentKey}"`);
    // config.yaml's max_tokens was never actually reaching the server before
    // this (STATUS.md 2026-08-14 session 10) — pi-ai's complete() only reads
    // options.maxTokens, not model.maxTokens, so generation was unbounded
    // (confirmed live via /slots: n_predict: -1) despite the config comment
    // claiming otherwise. This is the tail-risk fix, not a median-latency one.
    return this.#models.complete(model, { systemPrompt, messages, tools }, { maxTokens: model.maxTokens });
  }
}
