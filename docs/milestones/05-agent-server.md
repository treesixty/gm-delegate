# M5 — Agent server + ModelClient

**Read:** spec §3 (architecture), §5.1 (ModelClient), §1.5 (one model interface), §1.3 (why no bridge)
**Depends on:** M2 (the Interceptor is what the socket talks to)

---

## Why this matters

This is the seam. Get it right and local-vs-Claude is a config change; get it wrong and it
is a rewrite.

**Direction of control: the agent never touches Foundry.** It emits *intents*. The
Interceptor decides whether an intent becomes an action. If you find yourself giving the
agent a Foundry handle, stop — you have just rebuilt the thing §1.3 rejected.

---

## Build

Two halves.

### 1. `scripts/socket.js` — the Foundry side

WebSocket client to `localhost`. Receives intents, hands them to `handleIntent()`, returns
the structured result. Sends events from M4's EventBus. Receives nothing else.

`module.json` keeps `"socket": false` — that flag is Foundry's *cross-client* messaging,
which we do not use. This WS is our own, to our own server, on localhost. Not the same
thing. (Easy to confuse. It has been confused before.)

### 2. `gm-delegate-agent/` — the Node/Python server

```
Orchestrator          — receives events, decides whether to wake a subagent
ModelClient           — → /v1/chat/completions
EncounterAgent        — M6, not yet
```

### ModelClient — one interface, config per subagent

```yaml
# config.yaml
models:
  classifier:  { endpoint: "http://localhost:8080/v1", model: "qwen3.5-9b-q4km", max_tokens: 32 }
  encounter:   { endpoint: "http://localhost:8080/v1", model: "qwen3.5-9b-q4km", max_tokens: 200 }
embeddings:
  endpoint: "http://localhost:11434/api/embeddings"
  model: "nomic-embed-text"
```

Every model call goes through an **OpenAI-compatible `/v1/chat/completions` endpoint.**
That is the whole point: swapping any single subagent to Claude behind a shim must be a
config edit, not a code edit. Do not let a provider-specific call leak into agent code.

**Do not decide the model here.** It is OPEN, and it gets decided from M1's logs after
four real sessions — not from a leaderboard, and not from whichever one you tried first.

---

## Context assembly — do this now, it is cheap and it compounds

Split what you send the model into two blocks, and keep them separate in code:

| Block | Contents | Changes |
|---|---|---|
| **Stable** | system prompt, "beats not prose" constraints, output shape, voice rules | never, across runs |
| **Per-call** | Foundry state, roll provenance, the trigger, entity link | every call |

You are targeting a **9B**, where context pollution hurts most and tool-call validity has a
>95% kill criterion. A flat concatenation of everything is how you fail that. This costs
nothing to do now and is annoying to retrofit.

---

## Done when

- [ ] A **hardcoded** intent round-trips end to end:
      `agent → WS → Interceptor → executor → Foundry → result → agent`.
- [ ] A **rejected** intent round-trips too, and the agent receives the structured reason.
- [ ] `POLICY_REVOKED` from M3's RECLAIM reaches the agent and it stops emitting.
- [ ] Killing the agent server does not break Foundry. Killing Foundry does not crash the
      agent.
- [ ] Latency of the round trip is logged into M1's `latency_ms`. You have a **<5 s**
      budget for the whole card and you need to know what the hops cost.

---

## Traps

**The agent must handle rejection, not route around it.** No retry loop, no re-phrasing the
intent, no escalation path. A rejection is final. If you catch yourself writing
`if (rejected) tryAgainWith(...)`, you are building the thing the Interceptor exists to
prevent.

**Count your hops.** The <5 s kill criterion says: *"On a 9B generating 40 tokens, this
should be trivial. If you blow it, the problem is your orchestration hops, not your
hardware. Cut a hop."* Do not add an orchestration layer you cannot justify.

**No accounts, no gateway, no Patreon.** All localhost. If a design step requires a hosted
service, you have taken a wrong turn — reread §1.3.

---

## Out of scope

The five tools (M6). The card (M7). Any actual prompting of a model with a real task — M5
is plumbing, and a hardcoded intent is the right test.
