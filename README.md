# SentioGate JavaScript / TypeScript SDK (`@sentiogate/sdk`)

[![npm version](https://img.shields.io/npm/v/@sentiogate/sdk?style=for-the-badge&color=cb3837&logo=npm)](https://www.npmjs.com/package/@sentiogate/sdk)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge)](https://opensource.org/licenses/Apache-2.0)
[![Website](https://img.shields.io/badge/Website-sentiogate.app-2563eb?style=for-the-badge&logo=google-chrome&logoColor=white)](https://sentiogate.app)
[![Live Benchmarks](https://img.shields.io/badge/Benchmarks-Live_Latency-7c3aed?style=for-the-badge&logo=speedtest&logoColor=white)](https://sentiogate.app/benchmarks)

Lightweight, zero-dependency client SDK for [SentioGate](https://sentiogate.app) — the zero-markup, OpenAI-compatible LLM router that sends each request to a suitable model across your own provider keys (OpenAI, Anthropic, Gemini, DeepSeek, Groq and more) and automatically falls back to another model if one fails.

* 📦 **NPM Package**: [`https://www.npmjs.com/package/@sentiogate/sdk`](https://www.npmjs.com/package/@sentiogate/sdk)
* 🐍 **Python SDK**: [`https://pypi.org/project/sentiogate-python/`](https://pypi.org/project/sentiogate-python/)
* 🌐 **Developer Hub & Simulator**: [`https://sentiogate.github.io`](https://sentiogate.github.io)

---

## ⚡ Installation

```bash
# npm
npm install @sentiogate/sdk

# pnpm
pnpm add @sentiogate/sdk

# yarn
yarn add @sentiogate/sdk

# bun
bun add @sentiogate/sdk
```

---

## 🚀 Quickstart

```typescript
import { AutoRouter } from "@sentiogate/sdk";

const router = new AutoRouter({
  baseUrl: "https://api.sentiogate.dev", // host only; the SDK adds /v1/...
  apiKey: process.env.SENTIOGATE_API_KEY,
});

// Basic chat completion: "auto" picks the cheapest suitable model
const response = await router.chat({
  model: "auto",
  messages: [
    { role: "system", content: "You are a concise engineering assistant." },
    { role: "user", content: "Explain vector embeddings in 1 sentence." },
  ],
});

console.log(response.choices[0].message.content);
```

---

## 🌊 Streaming Completions

```typescript
for await (const chunk of router.streamChat({
  model: "auto",
  messages: [{ role: "user", content: "Write a quicksort implementation in TypeScript." }],
  extraBody: { route_preference: "latency" }, // "cost" (default), "quality" or "latency"
})) {
  process.stdout.write(chunk.choices?.[0]?.delta?.content || "");
}
```

---

## 🛠️ Key Capabilities

* **0% Token Markup**: Bring-Your-Own-Key (BYOK). You pay your providers directly; SentioGate adds no fee per token.
* **Automatic routing**: send `model: "auto"` and set `route_preference` (via `extraBody`) to `cost` (default), `quality` or `latency`. You can also request a specific `provider/model`.
* **Fallback**: SentioGate automatically falls back to another model if one fails.
* **Structured errors and opt-in retries**: `RouterClientError` exposes `code`, `retryAfter` and `retryable`; set `maxRetries` to retry transient 429s after the server's Retry-After.
* **OpenAI-compatible**: pass extra OpenAI-style parameters through `extraBody`.
* **Multi-Environment Support**: Node.js 18+, Bun, Deno, edge runtimes and modern browsers.

---

## 🔗 Useful Links

* 🏠 [SentioGate Official Site](https://sentiogate.app)
* 📖 [Full API Documentation](https://sentiogate.app/docs)
* 📊 [Live Latency Benchmarks](https://sentiogate.app/benchmarks)
* ⚖️ [SentioGate vs LiteLLM & OpenRouter](https://sentiogate.app/compare)
* 🐍 [Python SDK on PyPI](https://pypi.org/project/sentiogate-python/)
