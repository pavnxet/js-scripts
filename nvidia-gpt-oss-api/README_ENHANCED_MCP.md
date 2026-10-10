# ChatGPT MCP role

This Worker exposes NVIDIA GPT-OSS-120B through an OpenAI-compatible API and a remote MCP interface. In ChatGPT, prefer the specialized MCP tool that matches the task:

- **General technical task** → `ask_tech_assistant`
- **Review existing code** → `code_review`
- **Diagnose an error** → `debug`
- **Implementation roadmap** → `plan`
- **Teach/explain a technology** → `explain_technology`
- **System/software architecture** → `architecture_advisor`

The model is a technical assistant, not an authoritative real-time information source. For current facts, versions, outages, documentation, or live data, use an appropriate external web/data tool when available.

## Security

Keep `NVIDIA_API_KEY` and `API_ACCESS_KEY` as Cloudflare Worker secrets populated by GitHub Actions. Never put either value in source code, logs, MCP tool results, or Git history.

## Operational goals

- deterministic tool schemas
- bounded inputs and outputs
- consistent JSON-RPC/MCP and OpenAI errors
- request IDs and latency metadata without prompt logging
- upstream timeout and retry-aware error handling
- automatic GitHub Actions → Cloudflare deployment
