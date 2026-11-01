# Architectural Decision Records (ADRs): JS Scripts

## ADR-001: YouTube Playlist Sorting Strategy

- **Context**: Need to sort custom numbered playlist items (`001` to `050`) programmatically.
- **Decision**: Avoid synthetic HTML5 drag-and-drop / pointer simulation because YouTube uses internal sync routines tied to its action menu. Instead, reverse-sort by index and trigger the native `"Move to top"` menu action for each item from highest index down to `001`.
- **Consequences**: Fast, zero brittle drag events, reliable backend persistence on YouTube servers.

## ADR-002: ImgBB Auto Copy — batch signature instead of a boolean "handled" flag

- **Context**: The original snippet disconnected its `MutationObserver` after the first success and used
  `setTimeout` + `location.reload()`. Any mutation between copy and reload, a second upload in the same
  page session, or a stale `.queue-item.completed` could re-trigger a copy (or a reload loop).
- **Decision**: Fingerprint each upload batch by joining its viewer URLs (`state.signature`). A batch is
  handled once; a *different* fingerprint is treated as a new batch and handled again. Reload is
  skipped while any `.queue-item.uploading` / `.pending` exists.
- **Consequences**: No observer disconnect logic, no boolean reset bugs, multi-image drops work, and a
  canceled reload does not re-copy the same batch.

## ADR-003: Clipboard write order — `GM_setClipboard` → Clipboard API → `execCommand`

- **Context**: Upload completion is a network/DOM event, not a user gesture, so
  `navigator.clipboard.writeText()` can be rejected by Chrome's permission rules. A userscript manager
  clipboard grant is not subject to that restriction.
- **Decision**: Try `GM_setClipboard` first, fall back to the async Clipboard API, then to a hidden
  `<textarea>` + `execCommand('copy')`. If all fail, print the links with `console.log` and show an
  error toast.
- **Consequences**: Works in Tampermonkey/Violentmonkey and still degrades to a *visible* failure
  instead of a silent no-op.
