// modelClient.js — one interface, config per subagent (spec §1.5/§5.1),
// backed by @earendil-works/pi-ai (2026-08-13 decision, STATUS.md) instead
// of a hand-rolled fetch(). pi-ai already treats this project's exact
// situation — an OpenAI-compatible local endpoint (llama-server) serving a
// thinking model (Qwen3.5's reasoning content) — as first-class concepts
// (Model.reasoning, thinkingFormat, AssistantMessage's `thinking` content
// blocks), which the hand-rolled version used to leave to each call site.
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
            reasoning: true, // qwen3.5-9b-q4km is a thinking model — confirmed live, M5a
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192, // matches llama-server's -c 8192 this session actually started with
            maxTokens: cfg.max_tokens,
            thinkingFormat: "qwen", // Qwen's enable_thinking wire format
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
    return this.#models.complete(model, { systemPrompt, messages, tools });
  }
}
