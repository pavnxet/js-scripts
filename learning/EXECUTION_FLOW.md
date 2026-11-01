# Execution Flow: JS Scripts

## YouTube Playlist Sorter & Deduplicator Flow

```
User triggers action ("Sort" or "Remove Dups")
  │
  ├── 1. Scroll Loop (window.scrollTo until document.documentElement.scrollHeight stops increasing)
  │
  ├── 2. DOM Collection (querySelectorAll('ytd-playlist-video-renderer'))
  │
  ├── 3A. Deduplication Branch:
  │     ├── Track seen titles in Set
  │     └── If duplicate: Click 3-dot menu -> Click "Remove from..." -> Wait 1s
  │
  └── 3B. Sorting Branch:
        ├── Parse numeric prefix from #video-title (e.g. 001, 002)
        ├── Sort descending (050 -> 001)
        └── Loop through descending list:
              ├── Find current DOM item
              ├── Click 3-dot menu
              ├── Click "Move to top"
              └── Wait 1s for YouTube API sync
```

## ImgBB Auto Copy & Refresh Flow (`imgbb-auto-copy-refresh/`)

```
Page load on imgbb.com
  └── start() → MutationObserver(document.body, { childList, subtree, attributes: [class, data-result, href] })
        └── scheduleScan() — 150 ms debounce
              └── scan()
                    ├── config.enabled false → return
                    ├── uploadSucceeded()  →  [data-group="upload-result"][data-result="success"]
                    │                          / #upload-result[data-result="success"]
                    │                          / .queue-item.completed          (isVisible check)
                    ├── collectLinks()
                    │     ├── .queue-item.completed  →  a.image-link[href]
                    │     ├── fallback: #upload-result / #anywhere-upload / a.image-link[href*="ibb.co/"]
                    │     └── resolveDirect(): embed input/textarea → item <img> on i.ibb.co → null
                    ├── signature = viewer URLs joined by "|" ; identical → return (handled)
                    └── handleBatch(links)
                          ├── FORMATS[config.format].build(link) joined by "\n"
                          ├── copyText(): GM_setClipboard → navigator.clipboard → execCommand
                          ├── desktopNotify() when document.hidden
                          └── scheduleReload()
                                ├── autoRefresh off → toast only
                                ├── uploadInFlight() → toast + skip
                                └── countdown toast (cancelable) → location.reload()
```

Entry point: immediately-invoked function, `@run-at document-idle`, `@noframes`, host guard on
`/(^|\.)imgbb\.com$/i`.
