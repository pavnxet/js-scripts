# Reddit Sidebar Resizer

Adds a **draggable divider** between Reddit's main content column and the right sidebar, so you can
set the sidebar to whatever width you like. The chosen width is stored in `localStorage` and
restored the next time the script runs.

No dependencies, no build step — it is a single browser-side script you paste into the DevTools
console.

---

## Usage

1. Open a page on **<https://www.reddit.com>** that shows the right sidebar.
2. Wait for the page to finish rendering (the script needs Reddit's layout elements to exist).
3. Open DevTools (`F12`) → **Console** tab.
4. Copy the contents of [`reddit-sidebar-resizer.js`](reddit-sidebar-resizer.js), paste it into the
   console, and press **Enter**.
5. A thin divider line appears between the content and the sidebar — **drag it** to resize.

The console logs one confirmation line when it is ready.

---

## Behaviour

| Action | Result |
|---|---|
| Drag the divider | Sidebar width follows the cursor |
| Drag narrower than `80px` | Sidebar **snaps shut** (width `0`) |
| Drag wider than `700px` | Clamped to `700px` |
| Main column would fall under `300px` | The resize step is ignored |
| Hover the divider | Line brightens to 50% white and thickens to `2px` |
| While dragging | Line turns Reddit blue (`#0079d3`) |

The width is remembered under the `localStorage` key **`reddit-sidebar-width`** (default `316`).

---

## How it works

1. Finds Reddit's three layout elements: `.main-container`, `main.main`, `.right-sidebar`.
2. Removes any previous `#custom-resizer` (so re-running the script does not stack dividers).
3. Switches `.main-container` to a CSS grid: `1fr 1px <width>px` — the middle `1px` column is the
   divider slot.
4. Inserts a `10px`-wide, transparent drag handle over that divider, containing a always-visible
   `1px` line.
5. On drag, converts the cursor position into a sidebar width and re-applies the grid.
6. On release, restores the cursor and persists the width.

---

## Notes and limitations

- **It is a console snippet, so a full page reload drops it.** Reddit is a single-page app, so
  ordinary in-app navigation usually keeps it alive — but reload, and you need to paste it again.
- **A collapsed sidebar does not survive a reload.** Only widths greater than `0` are persisted, so
  the snapped-shut state resets to the last remembered width.
- **It depends on Reddit's current class names** (`.main-container`, `main.main`, `.right-sidebar`).
  If Reddit changes its layout, the script logs an explicit `console.error` rather than failing
  silently.
- It only changes the **client-side layout** — nothing is sent anywhere, and no Reddit data is read
  or modified.

---

## Files

| File | Purpose |
|---|---|
| [`reddit-sidebar-resizer.js`](reddit-sidebar-resizer.js) | The script |
| [`README.md`](README.md) | This document |
