# Thinking MCP

A public, stateless Cloudflare Workers remote MCP server that gives compatible AI clients a dedicated reasoning sub-agent backed by Cloudflare Workers AI.

## Tools

- `deep_think` — deep reasoning pass with a concise reasoning summary
- `critique` — challenge an answer, plan, argument, or code
- `plan` — turn a complex goal into an ordered execution plan
- `verify` — perform a final correctness/self-check

The server uses `@cf/moonshotai/kimi-k2.7-code` through Workers AI with thinking enabled. Private chain-of-thought is not returned; the server returns a useful reasoning summary instead.

## ChatGPT custom MCP app

The `/mcp` endpoint is intentionally **unauthenticated** so ChatGPT can connect to it as a remote MCP app without copying a bearer token. OpenAI documents remote MCP apps in ChatGPT Developer Mode.

1. Deploy this Worker to a public `workers.dev` URL.
2. In ChatGPT, open **Settings → Apps → Advanced Settings** and enable **Developer mode** if your plan/workspace supports it.
3. Choose **Create** / **Create app**.
4. Enter the MCP endpoint:

   `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/mcp`

5. Leave authentication unset because this server is public.
6. Run **Scan Tools**.
7. Create the app and enable it in a new chat.
8. Ask ChatGPT to use `deep_think`, `critique`, `plan`, or `verify`.

OpenAI currently documents full MCP app support and developer mode for Business and Enterprise/Edu workspaces; Pro users can connect custom MCPs with read/fetch permissions. Availability depends on your account/workspace rollout.

## Deploy

```bash
npm install
npx wrangler login
npm run deploy
```

After deployment, test:

```text
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/mcp
```

## Local development

```bash
npm install
npm run dev
```

MCP endpoint:

```text
http://localhost:8787/mcp
```

## Important security note

This ChatGPT-friendly build is public by design. Anyone who knows the endpoint can call the reasoning tools, and those calls can consume your Workers AI resources. Do not put secrets, private data, or privileged tools behind this server. For a private deployment, add OAuth/authorization instead of exposing it publicly.

## Architecture

```text
ChatGPT / Claude / Cursor / MCP client
              │
              │ Streamable HTTP
              ▼
       Thinking MCP Worker
              │
              ▼
       Workers AI / Kimi
              │
              ▼
      Reasoning summary
              │
              ▼
          AI client
```
