# YouTube Studio Upload Notifier

A Tampermonkey userscript that watches YouTube Studio's upload panel and fires a desktop
notification — with a looping custom sound — the moment a whole batch of uploads finishes
(for example, "Uploading 15 of 15").

---

## Features

- **Batch-complete detection** — reads the upload panel's counter (`span.count`, e.g.
  "Uploading 4 of 15") and notifies when every selected file is done, exactly once per batch.
- **Desktop notification + in-page popup** — a native notification plus an on-page card with a
  Close button.
- **Looping custom sound** — plays a configurable mp3 on repeat until you close the popup.
- **Error reporting** — the notification notes how many files ended in an error.
- **Resilient selectors** — keys off the live panel DOM, with two fallbacks (completion wording, or
  every row reading "100% uploaded").

---

## Where to run it

Tampermonkey, matching `https://studio.youtube.com/*`. Userscript only — there is no console-snippet
version.

---

## Preconditions

- Tampermonkey (or a compatible userscript manager) installed.
- Browser notification permission granted for `studio.youtube.com`.
- One user interaction with the page (a click or key press) so the browser permits audio playback.
- To use a **local** mp3 file (`E:\...`): add an `@resource` line pointing at
  `file:///E:/path/to/sound.mp3` and enable the extension's **"Allow access to file URLs"**. By default
  the script uses an online mp3 URL, so this is optional.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new userscript.
3. Copy the contents of
   [`youtube-studio-upload-notifier.user.js`](youtube-studio-upload-notifier.user.js) into it.
4. Save and enable the script.
5. Open YouTube Studio and start an upload — the notification fires when the batch completes.

---

## How it works

1. A `MutationObserver` on the page (plus a 5-second safety poll) calls `checkUploads()`.
2. `checkUploads()` reads `ytcp-multi-progress-monitor span.count` and parses `Uploading X of Y`.
3. When `X >= Y`, `finish()` fires once for the batch: a desktop notification, an on-page popup, and
   the looping sound.
4. Closing the popup (or the OS notification) stops the sound.

---

## Notes

- The popup is built with plain DOM nodes, because YouTube Studio enforces **Trusted Types** and
  blocks `element.innerHTML`.
- The sound loops only for the real notification; the debug "Test sound" button plays once.
- If YouTube changes the upload panel markup, update the selectors in the `SEL` object at the top of
  the script.

---

## Files

| File | Purpose |
|---|---|
| [`youtube-studio-upload-notifier.user.js`](youtube-studio-upload-notifier.user.js) | The userscript |
| [`README.md`](README.md) | This document |
