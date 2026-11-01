# SentioGate JavaScript / TypeScript SDK (`@sentiogate/sdk`)

[![npm version](https://img.shields.io/npm/v/@sentiogate/sdk?style=flat-square&color=blue)](https://www.npmjs.com/package/@sentiogate/sdk)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![Website](https://img.shields.io/badge/Website-sentiogate.app-2563eb?style=flat-square)](https://sentiogate.app)
[![Live Benchmarks](https://img.shields.io/badge/Benchmarks-Live_Latency-7c3aed?style=flat-square)](https://sentiogate.app/benchmarks)

Lightweight, zero-dependency client SDK for [SentioGate](https://sentiogate.app) — the zero-markup, intelligent AI LLM router that dynamically directs requests across OpenAI, Anthropic, Gemini, DeepSeek, and Groq with sub-20ms overhead.

---

## ⚡ Installation

```bash
# npm
npm install @sentiogate/sdk

# pnpm
pnpm add @sentiogate/sdk

# yarn
yarn add @sentiogate/sdk
```

---

## 🚀 Quickstart

```typescript
import { SentioGate } from "@sentiogate/sdk";

const gate = new SentioGate({
  apiKey: process.env.SENTIOGATE_API_KEY,
  // Optional: Supply your own keys for zero-markup BYOK routing
  providerKeys: {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  }
});

// Basic Chat Completion
const response = await gate.chat.completions.create({
  model: "auto:fastest", // Automatically routes to the lowest-latency model
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
const stream = await gate.chat.completions.create({
  model: "auto:cost-efficient",
  messages: [{ role: "user", content: "Write a quicksort implementation in TypeScript." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

---

## 🛠️ Key Capabilities

* **Zero Markup**: True BYOK architecture. No hidden fee per token.
* **Auto Routing Tags**:
  * `auto:fastest`: Routes to the replica with lowest Time-To-First-Token (TTFT).
  * `auto:cost-efficient`: Routes to highest quality model under your cost ceiling.
  * `auto:reliable`: Prioritizes 99.99% uptime with immediate circuit-breaker failover.
* **OpenAI Drop-In Compatibility**: Supports function calling, structured JSON output, tool use, and standard parameters.
* **Multi-Environment Support**: Works seamlessly in Node.js 18+, Bun, Deno, Cloudflare Workers, and modern browser environments.

---

## 🔗 Useful Links

* 🏠 [SentioGate Website](https://sentiogate.app)
* 📖 [Full API Documentation](https://sentiogate.app/docs)
* 📊 [Live Latency Benchmarks](https://sentiogate.app/benchmarks)
* ⚖️ [SentioGate vs LiteLLM & OpenRouter](https://sentiogate.app/compare)
* 🐍 [Python SDK](https://github.com/SentioGate/sentiogate-python)
