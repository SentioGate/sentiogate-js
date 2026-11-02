# SentioGate JavaScript / TypeScript SDK (`@sentiogate/sdk`)

[![npm version](https://img.shields.io/npm/v/@sentiogate/sdk?style=for-the-badge&color=cb3837&logo=npm)](https://www.npmjs.com/package/@sentiogate/sdk)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge)](https://opensource.org/licenses/Apache-2.0)
[![Website](https://img.shields.io/badge/Website-sentiogate.app-2563eb?style=for-the-badge&logo=google-chrome&logoColor=white)](https://sentiogate.app)
[![Live Benchmarks](https://img.shields.io/badge/Benchmarks-Live_Latency-7c3aed?style=for-the-badge&logo=speedtest&logoColor=white)](https://sentiogate.app/benchmarks)

Lightweight, zero-dependency client SDK for [SentioGate](https://sentiogate.app) — the zero-markup, intelligent AI LLM router that dynamically directs requests across OpenAI, Anthropic, Gemini, DeepSeek, and Groq with sub-20ms routing overhead.

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
  apiKey: process.env.SENTIOGATE_API_KEY,
});

// Basic Chat Completion
const response = await router.createChatCompletion({
  model: "auto:fastest", // Automatically routes to lowest-latency model replica
  messages: [
    { role: "system", content: "You are a concise engineering assistant." },
    { role: "user", content: "Explain vector embeddings in 1 sentence." }
  ],
});

console.log(response.choices[0].message.content);
```

---

## 🌊 Streaming Completions

```typescript
const stream = await router.streamChatCompletion({
  model: "auto:cost-efficient",
  messages: [{ role: "user", content: "Write a quicksort implementation in TypeScript." }],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

---

## 🛠️ Key Capabilities

* **0% Token Markup**: Pure Bring-Your-Own-Key (BYOK) architecture. No hidden fee per token.
* **Auto Routing Tags**:
  * `auto:fastest`: Routes to the replica with lowest Time-To-First-Token (TTFT).
  * `auto:cost-efficient`: Routes to highest quality model under your cost ceiling.
  * `auto:reliable`: Prioritizes 99.99% uptime with immediate circuit-breaker failover.
* **OpenAI Drop-In Compatibility**: Supports function calling, structured JSON output, tool use, and standard parameters.
* **Multi-Environment Support**: Works seamlessly in Node.js 18+, Bun, Deno, Cloudflare Workers, and modern browser environments.

---

## 🔗 Useful Links

* 🏠 [SentioGate Official Site](https://sentiogate.app)
* 📖 [Full API Documentation](https://sentiogate.app/docs)
* 📊 [Live Latency Benchmarks](https://sentiogate.app/benchmarks)
* ⚖️ [SentioGate vs LiteLLM & OpenRouter](https://sentiogate.app/compare)
* 🐍 [Python SDK on PyPI](https://pypi.org/project/sentiogate-python/)
