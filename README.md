# js-scripts

A collection of small browser and JavaScript utility scripts. Most are paste-into-DevTools snippets
or Tampermonkey userscripts; there is no build step and nothing to install.

---

## Repository structure

Each script lives in its **own top-level folder** named after it, containing the script and a
dedicated `README.md`:

```text
js-scripts/
├── README.md                          <-- this file: an index of everything in the repo
├── youtube-subscriptions-to-csv/
│   ├── README.md
│   └── youtube-subscriptions-to-csv.js
└── <script-name>/
    ├── README.md
    └── <script-name>.js
```

**Adding a new script:** create a top-level folder named after the script
(`my-new-script/`), place the script inside it, add a `README.md` describing what it does and how to
run it, then list it in the index below.

---

## Scripts

| Script | What it does | Where to run it |
|---|---|---|
| [`youtube-subscriptions-to-csv`](youtube-subscriptions-to-csv/) | Exports all rendered subscribed channels to CSV — canonical `UC...` ID, channel URL, and title. | `youtube.com/feed/channels` |

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
