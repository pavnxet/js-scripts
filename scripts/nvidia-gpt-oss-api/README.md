# NVIDIA GPT-OSS-120B API + ChatGPT MCP

This Cloudflare Worker exposes NVIDIA's hosted `openai/gpt-oss-120b` in two ways:

1. **OpenAI-compatible API** for apps, scripts, agents, and MCP servers.
2. **Remote MCP server** at `/mcp`, allowing ChatGPT to use GPT-OSS-120B as a specialized technical sub-agent/assistant.

## Architecture

```text
ChatGPT custom MCP app
        |
        |  POST /mcp
        v
Cloudflare Worker
        |
        | NVIDIA_API_KEY (Cloudflare secret)
        v
NVIDIA NIM
        |
        v
openai/gpt-oss-120b
```

The NVIDIA key stays server-side and is never returned to ChatGPT or other clients.

## HTTP endpoints

- `GET /health` — public health check.
- `GET /mcp` — authenticated MCP endpoint information.
- `POST /mcp` — authenticated Streamable HTTP MCP JSON-RPC endpoint.
- `GET /v1/models` — authenticated model list.
- `POST /v1/chat/completions` — authenticated OpenAI-compatible chat completions proxy.
- Other `/v1/*` requests are proxied to NVIDIA after authentication.

## MCP tools

ChatGPT can discover these tools from `/mcp`:

- `ask_tech_assistant` — general technical assistant for programming, APIs, AI, cloud, MCP, GitHub, automation, and architecture.
- `code_review` — security, correctness, bugs, maintainability, and performance review.
- `debug` — root-cause analysis and practical fixes for errors.
- `plan` — implementation plans, dependencies, risks, and verification.
- `explain_technology` — beginner/intermediate/advanced explanations.
- `architecture_advisor` — system architecture and trade-off advice.

All MCP tools are inference-only/read-only: they do not modify GitHub, Cloudflare, files, or external systems. They only ask GPT-OSS-120B to analyze the information supplied by ChatGPT.

## Connect to ChatGPT

ChatGPT supports remote MCP servers through custom apps/connectors. The exact UI and availability depend on the ChatGPT plan and workspace settings. OpenAI currently documents full MCP app support with developer mode for Business and Enterprise/Edu workspaces, while Pro users can use developer-mode MCP with read/fetch permissions where enabled. citehttps://help.openai.com/en/articles/12584461

Use this remote MCP URL:

```text
https://nvidia-gpt-oss-api.pavneet1804.workers.dev/mcp
```

The server requires a Bearer token matching `API_ACCESS_KEY`. If your ChatGPT MCP configuration offers HTTP header authentication, configure:

```text
Authorization: Bearer YOUR_API_ACCESS_KEY
```

Do **not** enter your `NVIDIA_API_KEY` into ChatGPT. ChatGPT only needs the proxy access key.

After the app is connected, ChatGPT can select/invoke the tools when relevant. Depending on the ChatGPT surface, you may see the app/tool name rather than a literal `@` tag. The model can then delegate technical subtasks to GPT-OSS-120B through this MCP server.

## Deploy automatically

GitHub Actions deploys this Worker when files under `scripts/nvidia-gpt-oss-api/` change.

Required GitHub Actions secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
NVIDIA_API_KEY
API_ACCESS_KEY
```

The workflow deploys the Worker and then writes the two runtime secrets to Cloudflare. Secrets are never committed to the repository.

## OpenAI-compatible API

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://nvidia-gpt-oss-api.pavneet1804.workers.dev/v1",
    api_key="YOUR_API_ACCESS_KEY",
)

response = client.chat.completions.create(
    model="openai/gpt-oss-120b",
    messages=[
        {"role": "user", "content": "Explain the class equation of a finite group."}
    ],
)

print(response.choices[0].message.content)
```

## Security

- Never commit `NVIDIA_API_KEY` or `API_ACCESS_KEY`.
- Keep authentication enabled on `/mcp` and `/v1/*`.
- `NVIDIA_API_KEY` is only used server-side.
- `API_ACCESS_KEY` is the client-to-proxy credential.
- This Worker does not increase NVIDIA's quota or bypass NVIDIA rate limits.
