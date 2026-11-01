# Session History: JS Scripts

## 2026-10-22: YouTube Playlist Sorting & Deduplication Research Memory

- **Task**: Saved research report and knowledge from `Playlist videos sorting .md` into project memory and created a skill file.
- **Created**:
  - `e:\Codes\Testing\.agents\skills\youtube-playlist-sorter\SKILL.md`: Complete skill containing DOM selectors, reverse move-to-top architecture, and full Tampermonkey / Console scripts.
  - `e:\Codes\Testing\js-scripts\AGENTS.md`: Local subproject agent instructions pointer.
  - `e:\Codes\Testing\js-scripts\learning\learning.md`: DOM selectors, infinite scroll techniques, and rate-limiting rules.
  - `e:\Codes\Testing\js-scripts\learning\DECISIONS.md`: ADR on reverse "Move to top" versus synthetic drag-and-drop.
  - `e:\Codes\Testing\js-scripts\learning\EXECUTION_FLOW.md`: Execution flow of the sorting and deduplicating script.
  - `e:\Codes\Testing\js-scripts\learning\summary.md`: Initial session log.
- **Outcome**: Reusable skill and subproject isolated memory persisted successfully.

## 2026-11-01: ImgBB Auto Copy & Refresh userscript

- **Task**: Add the user-supplied ImgBB copy-and-refresh snippet to `js-scripts` as a proper userscript, with enhancements, and wire it into the repo index/dashboard.
- **Created**:
  - `imgbb-auto-copy-refresh/imgbb-auto-copy-refresh.user.js` — v2.0.0 userscript (multi-image collection, 5 copy formats, configurable delay/format/auto-refresh via GM menu, cancelable toast, one-shot batch signature, in-flight upload guard, desktop notification, `Alt+Shift+C` re-copy, selector fallbacks).
  - `imgbb-auto-copy-refresh/README.md` — install, settings table, format table, flow diagram, troubleshooting.
- **Modified**:
  - `README.md` — repository structure block + Scripts & tools table row.
  - `index.html` — terminal listing line + dashboard card (`data-type="userscript"`).
  - `learning/learning.md` / `DECISIONS.md` (ADR-002, ADR-003) / `EXECUTION_FLOW.md` — ImgBB selectors, guard strategy, clipboard order, execution flow.
- **Verification**: `node --check` passes on the userscript.
- **Note**: Pre-existing local changes to `AGENTS.md` and the untracked `learning/` folder were left untouched/uncommitted.
