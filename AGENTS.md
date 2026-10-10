# AGENTS.md — Repository Management Guide

> Read this before creating, moving, renaming, or deleting any file in this repo. It is the
> authoritative convention guide for **js-scripts** (`pavnxet/js-scripts`).

---

## 1. What this repo is

A flat collection of standalone browser scripts, Tampermonkey userscripts, and small Cloudflare
Worker projects. Each item is **self-contained** in its own top-level folder.

- No monorepo build tooling, no shared framework, no root `package.json`.
- Browser scripts are paste-and-run; Worker projects carry their own `wrangler` config.

---

## 2. Directory structure (mandatory)

Every item lives in a **top-level folder** named after it (kebab-case), with the code and a
dedicated `README.md` inside:

```text
js-scripts/
├── AGENTS.md                      <-- this file (convention guide)
├── README.md                      <-- human-facing index of everything in the repo
├── index.html                     <-- GitHub Pages dashboard (links to each item)
├── <item-name>/                   <-- one folder per script / project
│   ├── README.md                  <-- what it does, how to run it, preconditions
│   └── <item-name>.js             <-- the script (or worker.js + wrangler.toml)
└── ...
```

**Do NOT** create a `scripts/`, `src/`, or `tools/` sub-folder that groups multiple items. Each item
gets its own top-level folder. This keeps the repo flat and self-describing.

---

## 3. Adding a new script — checklist

Follow these steps in order:

1. Create `./<kebab-case-name>/`.
2. Add the script file (named after the folder, or `worker.js` for a Worker).
3. Add a `README.md` in that folder covering:
   - What the script does (one or two sentences).
   - **Where to run it** (URL / environment / Tampermonkey match pattern).
   - **Preconditions** (e.g. "scroll to the bottom first", "requires GM_* grants").
   - Output/behavior notes and any limitations.
4. Add a row to the **"Scripts & tools"** table in the root `README.md`.
5. If it's a Cloudflare Worker, add/update its `.github/workflows/*.yml` deploy trigger paths.
6. If it should appear on the dashboard, add a card to `index.html`.

---

## 4. Script conventions

- **Zero dependencies.** A browser script must run as a single console paste; no bundler, no `npm`.
- **Self-contained IIFE** — `(function () { ... })();` — so nothing leaks to `window`.
- **Fail loudly.** Log an explicit `console.error` when run in the wrong context (wrong page, page not
  loaded) instead of returning silently.
- **Document preconditions** in the item's README.
- **Do not guess data.** If a value cannot be read, emit a visible sentinel (e.g. `ID_NOT_FOUND`)
  rather than a blank or a fabricated value.

---

## 5. Rules for modifying existing items

- **Never silently break paths.** If you move or rename a folder, update every reference to it:
  - root `README.md` table
  - `index.html` dashboard links
  - `.github/workflows/*.yml` (paths, `working-directory`, `cache-dependency-path`)
  - any READMEs that point at the old location
- **Resolve duplicates.** Do not keep a "full" and a "trimmed/stub" copy of the same script. Keep the
  complete version; delete the duplicate.
- **Preserve deployability.** Worker projects must keep their `wrangler.toml`/`wrangler.jsonc`,
  `package.json`, and `.dev.vars*` layout intact so CI can still deploy them.

---

## 6. Commit & push

- Commit messages are conventional and lowercase-summary (e.g. `Add <name> script`,
  `Flatten repo: ...`).
- Push to `main` as a fast-forward; do not force-push or rewrite published history.

---

## 7. Quick reference — current items

| Folder | Type | Deploy trigger |
|---|---|---|
| `youtube-subscriptions-to-csv/` | browser script | — |
| `reddit-thread-extractor/` | userscript | — |
| `youtube-hide-upcoming/` | userscript | — |
| `nvidia-gpt-oss-api/` | Cloudflare Worker | `.github/workflows/deploy-nvidia-gpt-oss-api.yml` |
| `thinking-mcp/` | Cloudflare Worker | `.github/workflows/deploy-thinking-mcp.yml` |
| `qr-print-station/` | web app | — |