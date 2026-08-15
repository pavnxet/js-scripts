# NVIDIA GPT-OSS-120B API + ChatGPT MCP

This Cloudflare Worker exposes NVIDIA's hosted `openai/gpt-oss-120b` in two ways:

1. **OpenAI-compatible API** for apps, scripts, agents, and MCP servers.
2. **OAuth 2.1 protected remote MCP server** at `/mcp`, allowing ChatGPT to use GPT-OSS-120B as a specialized technical sub-agent/assistant.

## Architecture

```text
ChatGPT custom MCP app
        |
        | OAuth 2.1 + PKCE
        v
Cloudflare Worker /mcp
        |
        | NVIDIA_API_KEY (Cloudflare secret)
        v
NVIDIA NIM
        |
        v
openai/gpt-oss-120b
```

The NVIDIA key stays server-side and is never returned to ChatGPT.

## OAuth endpoints

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-protected-resource/mcp`
- `GET /.well-known/oauth-authorization-server`
- `POST /oauth/register` — Dynamic Client Registration fallback.
- `GET/POST /oauth/authorize` — OAuth authorization + consent page.
- `POST /oauth/token` — authorization-code and refresh-token exchange.

The authorization server advertises **Client ID Metadata Documents (CIMD)** support and **S256 PKCE**. ChatGPT can therefore use its supported OAuth client setup method without receiving the NVIDIA API key.

During authorization, the Worker asks for the private owner authorization key stored as the existing `API_ACCESS_KEY` Cloudflare secret. That key is entered only on the Worker authorization page; it is not entered into the ChatGPT plugin configuration and is never sent to NVIDIA.

The Worker issues short-lived bearer access tokens and refresh tokens. Cloudflare KV is used to prevent authorization-code reuse and rotate refresh tokens.

## MCP endpoint

```text
https://nvidia-gpt-oss-api.pavneet1804.workers.dev/mcp
```

Use this URL in ChatGPT's **New Plugin / custom MCP server** screen and select **OAuth** authentication. ChatGPT should discover the OAuth metadata automatically.

## MCP tools

- `ask_tech_assistant` — general technical assistant for programming, APIs, AI, cloud, MCP, GitHub, automation, and architecture.
- `code_review` — security, correctness, bugs, maintainability, and performance review.
- `debug` — root-cause analysis and practical fixes for errors.
- `plan` — implementation plans, dependencies, risks, and verification.
- `explain_technology` — beginner/intermediate/advanced explanations.
- `architecture_advisor` — system architecture and trade-off advice.

All MCP tools are inference-only/read-only: they do not modify GitHub, Cloudflare, files, or external systems. They only ask GPT-OSS-120B to analyze information supplied by ChatGPT.

## Connect to ChatGPT

1. Open **New Plugin / custom MCP server**.
2. Name it `Nvidia Guide`.
3. Server URL:

```text
https://nvidia-gpt-oss-api.pavneet1804.workers.dev/mcp
```

4. Select **OAuth**.
5. Let ChatGPT discover the authorization server metadata.
6. Choose the available client setup method (CIMD when offered; DCR is supported as a fallback).
7. Complete the authorization page using your private owner authorization key.
8. Scan/discover the MCP tools and create the app.

Do **not** enter `NVIDIA_API_KEY` into ChatGPT.

## Deploy automatically

GitHub Actions deploys this Worker when files under `scripts/nvidia-gpt-oss-api/` change.

Required GitHub Actions secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
NVIDIA_API_KEY
API_ACCESS_KEY
```

The workflow automatically:

1. Verifies the Cloudflare credentials.
2. Creates the `nvidia-gpt-oss-api-oauth` KV namespace if it does not already exist.
3. Injects the KV namespace ID into the deployment configuration.
4. Deploys the Worker.
5. Stores `NVIDIA_API_KEY` and `API_ACCESS_KEY` as Cloudflare Worker secrets.

No manual Cloudflare deployment is required.

## OpenAI-compatible API

The legacy API remains available for scripts and applications:

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
- `NVIDIA_API_KEY` is only used server-side to call NVIDIA.
- `API_ACCESS_KEY` is an internal owner/OAuth signing secret; it is not the credential ChatGPT stores for MCP.
- OAuth access tokens are short-lived and scoped to `mcp:tools`.
- PKCE S256 is required for authorization-code exchange.
- Authorization codes are single-use when the OAuth KV binding is available.
- This Worker does not increase NVIDIA's quota or bypass NVIDIA rate limits.
