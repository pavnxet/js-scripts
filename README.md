# js-scripts

A flat collection of browser scripts, Tampermonkey userscripts, and small Cloudflare Worker
projects. Each item lives in its **own top-level folder** with a dedicated `README.md`; this file is
the index of everything in the repo.

---

## Repository structure

```text
js-scripts/
├── README.md                          <-- this file: an index of everything in the repo
├── index.html                         <-- GitHub Pages dashboard (links to the items below)
├── youtube-subscriptions-to-csv/      <-- browser script + README
├── reddit-thread-extractor/           <-- userscript + README
├── youtube-hide-upcoming/             <-- userscript + README
├── nvidia-gpt-oss-api/                <-- Cloudflare Worker project
├── thinking-mcp/                      <-- Cloudflare Worker project
└── qr-print-station/                  <-- standalone web app
```

**Adding a new script:** create a top-level folder named after it (kebab-case), place the script and
a `README.md` inside, then list it in the table below.

---

## Scripts & tools

| Item | What it does | Where to run it |
|---|---|---|
| [`youtube-subscriptions-to-csv`](youtube-subscriptions-to-csv/) | Exports every subscribed channel to CSV — canonical `UC...` ID, channel URL, and title. Console snippet + Tampermonkey userscript. | `youtube.com/feed/channels` |
| [`reddit-thread-extractor`](reddit-thread-extractor/) | Extracts a Reddit post + its comments/replies (auto-expanding) and exports JSON/CSV. | Tampermonkey, any `reddit.com` post |
| [`youtube-hide-upcoming`](youtube-hide-upcoming/) | Hides Upcoming/Premiere/Scheduled cards on YouTube, with a Tampermonkey toggle. | Tampermonkey, `*.youtube.com` |
| [`nvidia-gpt-oss-api`](nvidia-gpt-oss-api/) | OpenAI-compatible Cloudflare Worker proxy for NVIDIA's GPT-OSS-120B. | Deployed Worker |
| [`thinking-mcp`](thinking-mcp/) | Remote MCP server (Cloudflare Worker) providing reasoning tools. | Deployed Worker |
| [`qr-print-station`](qr-print-station/) | Browser A5 QR/image layout and print studio. | Web app, `./qr-print-station/` |

---

## Script conventions

- **Zero dependencies.** A browser script must run as a single console paste; no bundler, no `npm`.
- **Self-contained IIFE** — `(function () { ... })();` — so nothing leaks to `window`.
- **Fail loudly.** Log an explicit `console.error` when run in the wrong context (wrong page, page
  not loaded) instead of returning silently.
- **Document preconditions** in the script's README (for example, "scroll to the bottom first").
- **Do not guess data.** If a value cannot be read, emit a visible sentinel rather than a blank or a
  fabricated value.

---

## License

MIT
