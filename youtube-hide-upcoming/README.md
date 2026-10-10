# YouTube Hide Upcoming Cards

A Tampermonkey userscript that permanently hides **Upcoming / Premiere / Scheduled** video cards
on YouTube's subscription feed and search results, so only published videos remain visible.

---

## Features

- **Multi-language detection** — recognizes upcoming/premiere markers in English and Hindi
  (`upcoming`, `scheduled`, `premiere`, `waiting`, `live in`, `आने वाली`, `शेड्यूल`, `प्रीमियर`, …).
- **Live scanning** — reacts to YouTube's SPA navigation (`yt-navigate-finish`), scrolling, and DOM
  mutations via a `MutationObserver`, so cards are hidden even as YouTube lazy-loads more content.
- **Tampermonkey menu toggle** — a "Hide Upcoming: ON/OFF" entry lets you flip the filter without
  editing code; the preference persists via `GM_setValue`.
- **CSS + attribute based** — injects a global style rule targeting `[data-yt-upcoming="true"]` and
  tags matching cards on each scan.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new userscript.
3. Copy the contents of [`youtube-hide-upcoming.user.js`](youtube-hide-upcoming.user.js) into it.
4. Save and enable the script.
5. Open YouTube — upcoming cards are hidden automatically.

The script matches `*://*.youtube.com/*` and runs at `document-start`.

---

## How it works

1. On load, it injects a `<style>` rule that hides any element carrying `data-yt-upcoming="true"`.
2. `scanAndHideCards()` inspects each video card's badges, `aria-label`s, and inner text against a
   multi-language regex; matches get the `data-yt-upcoming` attribute and disappear.
3. A `MutationObserver` re-scans as YouTube adds/removes cards, and `yt-navigate-finish` + `scroll`
   listeners catch in-place navigation and infinite scroll.

---

## Notes

- Requires the Tampermonkey `GM_*` grants (`GM_registerMenuCommand`, `GM_setValue`, `GM_getValue`)
  declared in the metadata block.
- If YouTube changes its card markup or badge wording, the regex in
  `youtube-hide-upcoming.user.js` may need new patterns added.

---

## Files

| File | Purpose |
|---|---|
| [`youtube-hide-upcoming.user.js`](youtube-hide-upcoming.user.js) | The userscript |
| [`README.md`](README.md) | This document |
