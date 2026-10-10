# Reddit Sidebar Resizer

Adds a **draggable divider** between Reddit's main content column and the right sidebar, so you can
set the sidebar to whatever width you like. The chosen width is stored in `localStorage` and
restored automatically.

Two versions are provided — pick one:

| Version | File | Use when |
|---|---|---|
| **Tampermonkey userscript** (recommended) | [`reddit-sidebar-resizer.user.js`](reddit-sidebar-resizer.user.js) | You want it always on, surviving reloads and Reddit's in-app navigation. |
| **Console snippet** | [`reddit-sidebar-resizer.js`](reddit-sidebar-resizer.js) | You don't use Tampermonkey and prefer a one-off paste. |

Both apply the exact same layout and **share the same `localStorage` key**
(`reddit-sidebar-width`), so a width set with either version is picked up by the other.

---

## Option A — Tampermonkey userscript (recommended)

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new userscript.
3. Copy the contents of
   [`reddit-sidebar-resizer.user.js`](reddit-sidebar-resizer.user.js) into it.
4. Save and enable the script.
5. Open **<https://www.reddit.com>** — the divider appears on its own. **Drag it** to resize.

**Why this version is easier:** the console snippet is lost on every full page reload, and Reddit is
a single-page app that swaps out big parts of the DOM as you navigate. The userscript watches for
those re-renders and **re-applies itself automatically**, so your width survives both reloads and
in-app navigation.

It matches `https://www.reddit.com/*` and runs at `document-idle`.

---

## Option B — Console snippet

1. Open a page on **<https://www.reddit.com>** that shows the right sidebar.
2. Wait for the page to finish rendering (the script needs Reddit's layout elements to exist).
3. Open DevTools (`F12`) → **Console** tab.
4. Copy the contents of [`reddit-sidebar-resizer.js`](reddit-sidebar-resizer.js), paste it into the
   console, and press **Enter**.
5. A thin divider line appears — **drag it** to resize.

The console logs one confirmation line when it is ready.

---

## Behaviour

| Action | Result |
|---|---|
| Drag the divider | Sidebar width follows the cursor |
| Drag narrower than `80px` | Sidebar **snaps shut** (width `0`, `display:none`) |
| Drag wider than `700px` | Clamped to `700px` |
| Main column would fall under `300px` | The resize step is ignored |
| Hover the divider | Line brightens to 50% white and thickens to `2px` |
| While dragging | Line turns Reddit blue (`#0079d3`) |
| Reddit re-renders the page | Userscript re-applies the saved width (debounced ~250ms) |

The width is remembered under the `localStorage` key **`reddit-sidebar-width`** (default `316`).

---

## How it works

1. Finds Reddit's three layout elements: `.main-container`, `main.main`, `.right-sidebar`.
2. Removes any stale `#custom-resizer` (so re-running never stacks dividers).
3. Switches `.main-container` to a CSS grid: `1fr 1px <width>px` — the middle `1px` column is the
   divider slot.
4. Inserts a `10px`-wide, transparent drag handle over that divider, containing an always-visible
   `1px` line.
5. On drag, converts the cursor position into a sidebar width and re-applies the grid.
6. On release, restores the cursor and persists the width.

The userscript additionally runs a **debounced `MutationObserver`** over the document. When Reddit
navigates and replaces the layout subtree — which removes both the divider and the inline grid
styles — the observer re-mounts the divider and re-applies the saved width.

---

## Notes and limitations

- **A collapsed sidebar does not survive a reload.** Only widths greater than `0` are persisted, so
  the snapped-shut state resets to the last remembered width.
- **It depends on Reddit's current class names** (`.main-container`, `main.main`, `.right-sidebar`).
  If Reddit changes its layout, both versions log an explicit `console.error` rather than failing
  silently. The userscript waits 15 seconds before warning, since the layout may simply still be
  rendering.
- **It only changes the client-side layout** — nothing is sent anywhere, and no Reddit data is read
  or modified.
- The userscript targets only `www.reddit.com` (the current layout). Old Reddit
  (`old.reddit.com`) uses a different structure and is not supported.

---

## Files

| File | Purpose |
|---|---|
| [`reddit-sidebar-resizer.user.js`](reddit-sidebar-resizer.user.js) | Tampermonkey userscript (auto re-applies) |
| [`reddit-sidebar-resizer.js`](reddit-sidebar-resizer.js) | Console snippet |
| [`README.md`](README.md) | This document |
