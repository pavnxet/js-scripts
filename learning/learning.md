# Learning & Domain Knowledge: JS Scripts

## YouTube Playlist Automation & DOM Structure

### 1. Element Selectors
- Video row container: `ytd-playlist-video-renderer`
- Video title: `#video-title`
- Row 3-dot action button: `button[aria-label="Action menu"]`
- Action menu container: `ytd-menu-service-item-renderer`, `tp-yt-paper-item`
- Action matchers:
  - Remove from playlist: `el.textContent.includes('Remove from')`
  - Move to top: `el.textContent.includes('Move to top')`
- Drag handle: `div#index-container yt-icon#reorder` (`.playlist-drag-handle`)

### 2. Gotchas & Best Practices
- **Drag-and-Drop Pitfall**: Custom Polymer component drag simulation via synthetic mouse events does not cleanly trigger YouTube backend persistence.
- **Reliable Sorting Strategy**: Reverse order iteration with "Move to top". Sort descending by number (`050` down to `001`), moving each to top sequentially. When `001` is moved to top last, the entire list ends up ordered `001 -> 050` and saves permanently.
- **Throttling**: Provide 500ms - 1000ms delay between opening the action menu and clicking menu items to allow YouTube's DOM rendering and API network calls to settle.
- **Infinite Scrolling**: Always auto-scroll (`window.scrollTo(0, scrollHeight)`) until height stops changing before processing list length.

## ImgBB Upload Page (userscripts)

### 1. Selectors (verified paths in the snippet, treat as best-effort)
- Upload container: `#anywhere-upload`
- Success marker: `[data-group="upload-result"][data-result="success"]`
- Completed queue item: `.queue-item.completed` (also tagged `data-result="success"` sometimes)
- Viewer link inside an item: `a.image-link[href]` → `https://ibb.co/<id>`
- Direct link: `https://i.ibb.co/<id>/<filename>` — only derivable when the page exposes the file name
  (embed field or the item's `<img src>`). Never fabricate the path from the id alone.
- In-flight items: `.queue-item.uploading`, `.queue-item.pending`

### 2. Gotchas & Best Practices
- **Clipboard needs a grant**: upload completion is not a user gesture, so `navigator.clipboard.writeText`
  may be rejected. Prefer `GM_setClipboard`, then Clipboard API, then hidden `textarea` + `execCommand`.
- **Never reload from inside a `MutationObserver` callback without a guard** — it re-mounts the same
  success DOM on a slow page and loops. Fingerprint the batch (link URLs) before acting.
- **Debounce observers**: `attributes: true, subtree: true` on `document.body` fires constantly; 150 ms
  debounce keeps the scan cheap.
- **Multi-image drops**: collect all `.queue-item.completed` anchors and dedupe by `href`; copy one link
  per line rather than only the first.
- **Don't reload while an upload is in flight** (`.queue-item.uploading`), otherwise the queued file is
  discarded.
- **Toast over `alert()`**: non-blocking DOM toast with a cancel action keeps the workflow usable.
