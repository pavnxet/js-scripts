# YouTube Subscriptions → CSV

Exports every subscribed channel from YouTube's Subscriptions management page into a CSV file
containing the canonical **Channel ID** (`UC...`), the **Channel URL**, and the **Channel Title**.

No dependencies, no build step. Two versions are provided — pick one:

| Version | File | Use when |
|---|---|---|
| **Tampermonkey userscript** (recommended) | [`youtube-subscriptions-to-csv.user.js`](youtube-subscriptions-to-csv.user.js) | You want a button on the page and the list auto-scrolled for you. |
| **Console snippet** | [`youtube-subscriptions-to-csv.js`](youtube-subscriptions-to-csv.js) | You don't use Tampermonkey and prefer a one-off paste. |

Both produce the exact same CSV and share the same extraction logic.

---

## Option A — Tampermonkey userscript (recommended)

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new userscript.
3. Copy the contents of
   [`youtube-subscriptions-to-csv.user.js`](youtube-subscriptions-to-csv.user.js) into it.
4. Save and enable the script.
5. Open **<https://www.youtube.com/feed/channels>**.
6. Click the **"Subscriptions → CSV"** button in the bottom-right corner.

The script **scrolls the list automatically** until no new channels load, then downloads the CSV.
A live status line reports how many channels have been found so far. The export is also available
from the Tampermonkey menu ("Export subscriptions to CSV").

**Why this version is easier:** the console version requires you to scroll the entire list by hand
before running it, because YouTube lazy-loads the grid. This version does that scrolling for you.

Tunables live at the top of the file:

| Constant | Default | Purpose |
|---|---|---|
| `SCROLL_DELAY_MS` | `900` | Wait after each scroll for lazy-loaded cards. |
| `STABLE_ROUNDS` | `3` | Consecutive no-growth rounds before stopping. |
| `MAX_ROUNDS` | `200` | Hard safety cap against an endless feed. |

---

## Option B — Console snippet

1. Open **<https://www.youtube.com/feed/channels>**.
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

Both versions de-duplicate by channel ID, so a card re-rendered during scrolling is not counted twice.

---

## How it works

Both versions query each card type YouTube can render — `ytd-grid-channel-renderer` (grid view) and
`ytd-channel-renderer` (list view) — then for each card:

- reads the title from `#title` or `#channel-title`;
- reads the URL from `a#main-link`, `a#thumbnail`, or `a.ytd-simple-endpoint`;
- resolves the canonical channel ID from the element's bound Polymer data, trying in order:
  1. `el.data.channelId`
  2. `el.data.navigationEndpoint.browseEndpoint.browseId`
  3. `el.__data.data.navigationEndpoint.browseEndpoint.browseId`
  4. falls back to the literal sentinel `ID_NOT_FOUND`

Finally it builds a UTF-8 `Blob` (with BOM) and triggers a download via a temporary hidden anchor.

The userscript additionally scrolls to the bottom in a loop, nudging the last rendered card into
view, until the card count and page height stop growing for `STABLE_ROUNDS` consecutive rounds.

---

## Notes and limitations

- **The visible URL is not the channel ID.** Modern YouTube shows `/@handle` URLs, which do not
  contain the `UC...` token at all — the ID can only be read from the page's internal data, which is
  why these scripts do not parse it out of the link.
- **Only rendered channels are exported.** This is a hard consequence of YouTube's lazy loading, not
  a bug. The userscript scrolls automatically; the console version needs a manual scroll first.
- **`ID_NOT_FOUND` is intentional.** A missing ID is written as a visible sentinel rather than left
  blank, so gaps in the output are obvious instead of silent.
- The ID comes from an undocumented internal structure. If Google changes it, IDs degrade to
  `ID_NOT_FOUND` — detectable immediately rather than quietly wrong.
- The file is UTF-8 **with BOM**, so non-ASCII titles (emoji, Devanagari, etc.) open correctly in Excel.
- Safe to re-run: both versions are self-contained IIFEs and leak nothing to `window`.

---

## Files

| File | Purpose |
|---|---|
| [`youtube-subscriptions-to-csv.user.js`](youtube-subscriptions-to-csv.user.js) | Tampermonkey userscript (auto-scroll + on-page button) |
| [`youtube-subscriptions-to-csv.js`](youtube-subscriptions-to-csv.js) | Console snippet (manual scroll) |
| [`README.md`](README.md) | This document |
