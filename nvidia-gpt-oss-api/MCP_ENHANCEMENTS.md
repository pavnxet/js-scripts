# NVIDIA GPT-OSS-120B ChatGPT MCP Enhancements

## Design guidance

This service is intentionally a thin technical-assistant layer over NVIDIA GPT-OSS-120B. Keep the six MCP tools focused and deterministic:

- `ask_tech_assistant`: general technical reasoning and implementation guidance.
- `code_review`: correctness, security, maintainability, performance, and concrete fixes.
- `debug`: root cause first, then the smallest reliable fix and verification.
- `plan`: implementation plan with dependencies, risks, and acceptance checks.
- `explain_technology`: clear explanations at beginner/intermediate/advanced levels.
- `architecture_advisor`: components, data flow, security, deployment, scaling, and trade-offs.

## Recommended enhancements

1. Add a stable MCP server-info endpoint and health endpoint.
2. Require `Authorization: Bearer <API_ACCESS_KEY>` for MCP and API routes; use constant-time comparison for the secret.
3. Validate MCP tool arguments and cap input sizes before calling NVIDIA.
4. Give every tool a strict output contract so ChatGPT can reliably consume the result.
5. Add a lightweight per-key/IP rate limit at the Worker edge. Do not pretend KV writes are atomic; use a Durable Object if strict global rate limiting is required.
6. Return consistent JSON-RPC/MCP errors and OpenAI-compatible API errors instead of leaking upstream errors or secrets.
7. Add request IDs and structured logs containing only route, tool, status, latency, and model. Never log prompts, API keys, or authorization headers.
8. Add upstream timeout handling and map NVIDIA 429/5xx responses to useful retryable errors with `Retry-After` when available.
9. Keep streaming behavior transparent for `/v1/chat/completions` and avoid buffering large responses unnecessarily.
10. Add a small test suite for auth, health, MCP initialize/tools/list, each tool schema, upstream error mapping, and API compatibility.
11. Keep deployment entirely in GitHub Actions; GitHub secrets should be copied to Cloudflare Worker secrets during deployment, never committed.
12. Keep the MCP prompt/instructions explicit that the service is a technical guide backed by GPT-OSS-120B, not a source of authoritative real-time facts; use external tools when fresh information is required.

## ChatGPT-oriented behavior

The MCP tool descriptions should make routing obvious. Prefer the specialized tool when the user's task is clearly code review, debugging, planning, explanation, or architecture. Use `ask_tech_assistant` for mixed or general technical requests. Avoid exposing internal prompts or secret configuration in tool results.

## Verification checklist

- `/health` returns 200 without revealing secrets.
- Protected endpoints reject missing/invalid credentials with 401/403.
- MCP `initialize` succeeds with a current protocol version supported by the target ChatGPT connector.
- MCP `tools/list` returns all six tools with valid JSON Schemas.
- Each `tools/call` reaches NVIDIA and returns a structured result.
- NVIDIA 429/5xx responses are normalized and do not expose upstream credentials.
- GitHub Actions deploys the Worker and sets both Cloudflare secrets automatically.
