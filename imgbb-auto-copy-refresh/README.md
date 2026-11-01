# ImgBB Auto Copy & Refresh

A Tampermonkey userscript for [imgbb.com](https://imgbb.com/) that copies the link of every image you
just uploaded, shows a small toast, and then reloads the upload page so the next upload is one click
away. Built for people who drop screenshots into ImgBB all day and are tired of clicking *Copy* and
*Upload* again.

---

## Features

- **Copies automatically.** As soon as ImgBB reports a successful upload, the link is on your
  clipboard — no clicking the copy button.
- **Handles multi-image uploads.** Every completed item in the queue is collected, so a 5-image drop
  copies 5 links (one per line) instead of just the first one.
- **Five copy formats.** Viewer URL, direct `i.ibb.co` link, BBCode, HTML, or Markdown. Cycle them
  from the Tampermonkey menu.
- **Visible toast, not just the console.** Shows what was copied, in which format, and a live
  countdown before the reload. A **Cancel refresh** button keeps you on the page.
- **Safe reload.** One-shot per upload batch (a `MutationObserver` cannot trigger a reload loop), the
  observer is debounced, and the reload is skipped if a newer upload is still in flight.
- **Configurable.** Auto copy on/off, auto refresh on/off, delay (1s → 10s), format, toast and
  desktop notification — all persisted with `GM_setValue`.
- **Desktop notification** when the upload finishes while the tab is in the background.
- **`Alt` + `Shift` + `C`** copies the last batch again without touching the page.
- **Robust selectors.** Several fallbacks for ImgBB's result markup, a `document.body` observer, and
  retry if the DOM is not ready yet. If a direct link cannot be resolved from the page, it falls back
  to the viewer URL instead of inventing one.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey).
2. Open the raw script:
   <https://raw.githubusercontent.com/pavnxet/js-scripts/main/imgbb-auto-copy-refresh/imgbb-auto-copy-refresh.user.js>
3. Approve the install, then open <https://imgbb.com/> and upload an image.

**Preconditions:** the script must run on `imgbb.com` / `*.imgbb.com`. It only reacts after an upload
succeeds — merely browsing image pages never triggers a copy or a reload.

---

## Settings (Tampermonkey menu)

Click the Tampermonkey icon on an ImgBB tab:

| Menu entry | Values | Default |
|---|---|---|
| Auto copy | ON / OFF | ON |
| Auto refresh | ON / OFF | ON |
| Reload delay | 1s, 1.5s, 2.5s, 4s, 6s, 10s | 1.5s |
| Copy format | Viewer URL, Direct link, BBCode, HTML, Markdown | Direct link |
| Copy the last links again | — | shortcut `Alt`+`Shift`+`C` |
| Reset settings to defaults | — | — |

Settings are stored with `GM_setValue` and survive updates.

---

## Copy formats

For an upload whose viewer page is `https://ibb.co/abc123` and whose file is `photo.png`:

| Format | Output |
|---|---|
| Viewer URL | `https://ibb.co/abc123` |
| Direct link | `https://i.ibb.co/abc123/photo.png` |
| BBCode | `[img]https://i.ibb.co/abc123/photo.png[/img]` |
| HTML | `<img src="https://i.ibb.co/abc123/photo.png" alt="photo.png">` |
| Markdown | `![photo.png](https://i.ibb.co/abc123/photo.png)` |

Multiple uploads are joined with a newline.

---

## How it works

```
Upload finishes
  └─ MutationObserver (document.body, debounced 150 ms)
       └─ uploadSucceeded()  →  [data-group="upload-result"][data-result="success"]
                                / #upload-result[data-result="success"]
                                / .queue-item.completed
            └─ collectLinks()  →  completed queue items → .image-link[href]
                 └─ resolveDirect()  →  embed field, else the item's <img> on i.ibb.co
                      └─ copyText()  →  GM_setClipboard → Clipboard API → execCommand
                           └─ toast + optional desktop notification
                                └─ countdown (cancelable) → location.reload()
```

- The batch is fingerprinted by its link URLs. The same batch is never copied twice, and a *different*
  batch (new uploads before a reload) is picked up and handled.
- Before reloading, the script checks for `.queue-item.uploading` / `.pending`. If one exists, the
  reload is skipped so an in-progress upload is not thrown away.
- `BBCode`, `HTML` and `Markdown` values are generated from the same resolved link, so they always match
  what was copied.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Nothing happens after an upload | Confirm the script is enabled and the tab is `imgbb.com`. Check the console for `[ImgBB Auto Copy]` messages. |
| "Clipboard blocked" toast | The browser refused all clipboard paths; the links are printed to the console. Keep `GM_setClipboard` granted in Tampermonkey. |
| Direct link equals the viewer URL | ImgBB did not expose the file name on that page. The script intentionally falls back rather than guessing the `i.ibb.co` path. |
| Page does not reload | Auto refresh is off, the delay is long, or another upload is in flight. Check the menu. |
| Reload loop | Should be impossible (one-shot per batch), but if it ever happens, disable auto refresh from the menu. |

---

## Notes

- **Selector drift.** ImgBB's upload UI is not a public API. If the queue markup changes, update
  `SUCCESS_SELECTORS`, `COMPLETED_SELECTOR` and `FALLBACK_ANCHOR_SELECTORS` at the top of section 4.
- **No network calls.** The script reads the DOM only; it never talks to ImgBB's API.
- **Zero dependencies**, single IIFE, no build step.

---

## Files

| File | Purpose |
|---|---|
| [`imgbb-auto-copy-refresh.user.js`](imgbb-auto-copy-refresh.user.js) | The userscript |
| [`README.md`](README.md) | This document |
