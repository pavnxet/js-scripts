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
5. **Always add a card to `index.html`** — mandatory, never skipped (see §8 for the template).
6. If it's a Cloudflare Worker, add/update its `.github/workflows/*.yml` deploy trigger paths.
7. Add a row to the quick-reference table in §7 of this file.

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

- **Keep every index in sync.** Three places list what this repo contains:
  1. the root `README.md` "Scripts & tools" table,
  2. the `index.html` dashboard (cards **and** the hero terminal `ls` listing),
  3. the quick-reference table in §7 of this file.

  Anything created, renamed or removed must be reflected in **all three in the same commit**. A task
  is not finished while an item exists in the repo but is missing from any index — or while an index
  points at something that no longer exists.
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
| `youtube-subscriptions-to-csv/` | snippet + userscript | — |
| `reddit-thread-extractor/` | userscript | — |
| `reddit-sidebar-resizer/` | snippet + userscript | — |
| `youtube-hide-upcoming/` | userscript | — |
| `nvidia-gpt-oss-api/` | Cloudflare Worker | `.github/workflows/deploy-nvidia-gpt-oss-api.yml` |
| `thinking-mcp/` | Cloudflare Worker | `.github/workflows/deploy-thinking-mcp.yml` |
| `qr-print-station/` | web app | — |

---

## 8. Dashboard / index updates (`index.html`) — mandatory

`index.html` is the GitHub Pages landing page. It must list **every** item in the repo. Whenever you
add, rename or remove an item, update the dashboard **in the same commit** — two places:

1. **The hero terminal `ls` block** — the list of `<div class="blue">folder-name/</div>` lines.
2. **A card in the `.grid`** — copy this template:

```html
<article class="card" data-name="lowercase search keywords" data-type="userscript">
  <div class="icon">XX</div>
  <h3>Display Name</h3>
  <p>One or two sentences on what it does.</p>
  <div class="meta"><span class="tag">Userscript</span><span class="tag">JavaScript</span><span class="tag">YouTube</span></div>
  <div class="open"><a href="https://github.com/pavnxet/js-scripts/tree/main/<folder>" target="_blank" rel="noopener noreferrer">Open project <span class="arrow">→</span></a><span class="open-actions"><a class="mini" href="https://github.com/pavnxet/js-scripts/tree/main/<folder>" target="_blank" rel="noopener noreferrer">README</a></span></div>
</article>
```

Rules for the card:

- **All tags live in `.meta` — including the type tag** (`Script` / `Userscript` / `Worker` / `Web app` /
  `Notes`). Nothing tag-shaped goes in the footer: that is what keeps every card's tag row in one place
  instead of staggering up and down.
- `data-type` drives the filter chips — use one or more of `script`, `userscript`, `worker`,
  `webapp`, `notes`, space-separated. An item that is both a snippet and a userscript gets both.
- `data-name` is the **search index**: lowercase name + description keywords + tags. A card without
  it becomes unsearchable.
- The footer (`.open`) holds the primary link on the left and `.open-actions` pills on the right, and
  **must stay one line**. `.meta` is bottom-anchored (`margin-top: auto`), which is what lines every
  card's footer up regardless of description length or tag count. Keep it to **at most 3 action pills**
  and short labels — the widest footer must fit in roughly 290px.
- Every card needs a **README link** in `.open-actions`.
- Userscripts (`*.user.js`) also get an install link to the raw URL:
  `https://raw.githubusercontent.com/pavnxet/js-scripts/main/<folder>/<file>.user.js` — label it
  `⤓ Install`.
- Paste-in scripts also get a copy button:
  `<button class="mini" type="button" data-copy="./<folder>/<file>.js">⧉ Copy</button>`.
- **No JavaScript changes are needed** — the dashboard script auto-discovers `.card` elements on
  load. Just add the markup.
- Reuse the existing classes (`.card`, `.icon`, `.meta`, `.tag`, `.open`, `.open-actions`, `.mini`); do
  not invent bespoke inline styles.
- The grid uses `repeat(auto-fill, minmax(310px, 1fr))`, so cards never get too narrow for a
  one-line footer. Do not switch it back to a fixed `repeat(3, 1fr)`.
- The dashboard uses the **PAVNXET Liquid Glass v2 (advanced)** theme — a warm aurora mesh under
  translucent, refracting glass surfaces. Never hard-code colours: use the tokens in `:root`, and add
  any new token to **both** `:root` and `[data-theme=dark]` so the light and dark variants stay correct.
- v2 rules worth preserving:
  - **Scope transitions.** Use `--transition-liquid` / `--transition-elastic` (explicit property
    lists) instead of `transition: all`, which animates unnecessary properties.
  - **Animate `transform`, not layout/paint properties.** The aurora drifts by translating and
    scaling itself (it is `inset: -10%` so there is room), rather than animating `background-position`.
  - **Keep card content above the speculars.** `.card::before`/`::after` sit at `z-index: 2`, so
    `.card > *` is lifted to `z-index: 3`. If you add a wrapper inside a card, give it `z-index: 3`.
  - **Ambient animation pauses while scrolling** via `body.is-scrolling` (toggled by the dashboard
    script), and is disabled entirely under `prefers-reduced-motion`.
- Do not nest `backdrop-filter` — small pills (`.tag`, `.chip`, `.mini`, `kbd`) deliberately use
  translucent gradients *without* blur, since they sit on already-blurred glass. Blur is reserved
  for the major surfaces (`.nav`, `.card`, `.hero-card`, `.search`, `.terminal`, `.empty`, `.footer`).
- The grid's closing `</div>` must stay **after** the last card. Insert new cards before it.