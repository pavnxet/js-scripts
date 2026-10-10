# YouTube Subscriptions → CSV

Exports every subscribed channel from YouTube's Subscriptions management page into a CSV file
containing the canonical **Channel ID** (`UC...`), the **Channel URL**, and the **Channel Title**.

No dependencies, no build step — it is a single browser-side script you paste into the DevTools
console.

---

## Usage

1. Open **<https://www.youtube.com/feed/channels>** (Subscriptions management page).
2. **Scroll to the bottom of the list repeatedly** until no new channels load.
   YouTube lazy-loads the grid, so channels that were never scrolled into view are not in the DOM
   and cannot be exported.
3. Open DevTools (`F12`) → **Console** tab.
4. Copy the contents of [`youtube-subscriptions-to-csv.js`](youtube-subscriptions-to-csv.js),
   paste it into the console, and press **Enter**.
5. `youtube_subscriptions.csv` is saved to your Downloads folder.

---

## Output

```csv
Channel ID,Channel URL,Channel Title
UCxxxxxxxxxxxxxxxxxxxxxx,https://www.youtube.com/@SomeHandle,"Some Channel Name"
```

| Column | Source |
|---|---|
| `Channel ID` | Canonical `UC...` ID read from the renderer's internal Polymer data |
| `Channel URL` | The anchor `href` on the channel card |
| `Channel Title` | The display name shown on the card |

---

## How it works

The script queries both card types YouTube can render — `ytd-grid-channel-renderer` (grid view) and
`ytd-channel-renderer` (list view) — then for each card:

- reads the title from `#title` or `#channel-title`;
- reads the URL from `a#main-link`, `a#thumbnail`, or `a.ytd-simple-endpoint`;
- resolves the canonical channel ID from the element's bound Polymer data, trying in order:
  1. `el.data.channelId`
  2. `el.data.navigationEndpoint.browseEndpoint.browseId`
  3. `el.__data.data.navigationEndpoint.browseEndpoint.browseId`
  4. falls back to the literal sentinel `ID_NOT_FOUND`

Finally it builds a UTF-8 `Blob` (with BOM) and triggers a download via a temporary hidden anchor.

---

## Notes and limitations

- **The visible URL is not the channel ID.** Modern YouTube shows `/@handle` URLs, which do not
  contain the `UC...` token at all — the ID can only be read from the page's internal data, which is
  why this script does not parse it out of the link.
- **Only rendered channels are exported.** This is a hard consequence of YouTube's lazy loading, not
  a bug. Scroll fully before running.
- **`ID_NOT_FOUND` is intentional.** A missing ID is written as a visible sentinel rather than left
  blank, so gaps in the output are obvious instead of silent.
- The ID comes from an undocumented internal structure. If Google changes it, IDs degrade to
  `ID_NOT_FOUND` — detectable immediately rather than quietly wrong.
- The file is UTF-8 **with BOM**, so non-ASCII titles (emoji, Devanagari, etc.) open correctly in Excel.
- Safe to re-run: the script is a self-contained IIFE and leaks nothing to `window`.

---

## Files

| File | Purpose |
|---|---|
| [`youtube-subscriptions-to-csv.js`](youtube-subscriptions-to-csv.js) | The script |
| [`README.md`](README.md) | This document |
