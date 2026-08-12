# Thinking MCP

A remote MCP server for AI clients that do not have a native thinking/reasoning mode.

It exposes four tools:

- `deep_think` — deep reasoning pass with concise reasoning summary
- `critique` — challenge an existing answer/plan/argument
- `plan` — produce an execution plan
- `verify` — final correctness/self-check

The server uses Cloudflare Workers AI and Kimi K2.7 Code with thinking enabled.

## 1. Install

```bash
npm install
```

## 2. Configure the authentication token

For local development, copy `.dev.vars.example` to `.dev.vars` and replace the token.

For production:

```bash
npx wrangler secret put MCP_AUTH_TOKEN
```

Enter a long random token when prompted.

## 3. Run locally

```bash
npm run dev
```

MCP endpoint:

```text
http://localhost:8787/mcp
```

## 4. Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest
```

Connect the inspector to:

```text
http://localhost:8787/mcp
```

Use the Bearer token configured in `.dev.vars`.

## 5. Deploy

```bash
npm run deploy
```

Your endpoint will be:

```text
https://thinking-mcp.<YOUR_SUBDOMAIN>.workers.dev/mcp
```

Use the same Bearer token as the MCP authorization credential.

## How the thinking works

The MCP protocol itself does not add hidden reasoning to the client model. Instead, the client gets access to a `deep_think` tool.

When the client calls it:

```text
Your AI
  -> deep_think
  -> Thinking MCP
  -> Kimi K2.7 Code with thinking enabled
  -> concise reasoning summary
  -> Your AI
  -> final answer
```

The server intentionally does not return private chain-of-thought. It returns a useful reasoning summary, assumptions, alternatives, verification, and conclusion.

## Security

Do not deploy this without authentication. Every `deep_think` call consumes Workers AI resources.

For production SaaS-style deployments, replace the simple Bearer token with OAuth or Cloudflare Access.
