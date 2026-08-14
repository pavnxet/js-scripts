# Reddit Thread Extractor

A browser-side Reddit thread exporter for content that is already loaded in the current Reddit page.

## What changed in v2

The original script tried to drive Reddit's internal comment-loading controls and depended heavily on private DOM details such as `faceplate-partial`, `more-comments`, and a specific set of `shreddit-*` elements. Those details can change without notice, and the script could stop at partial results or fail completely.

Version 2 uses a safer and more stable model:

1. Open a Reddit **post/thread** in your browser.
2. Install the script in Tampermonkey (or another userscript manager).
3. The extractor adds a small **Reddit Extractor** panel to the page.
4. Reddit loads the post/comments normally. You can expand or load additional comments yourself.
5. Click **Scan loaded content**.
6. The script reads the content currently present in the page and builds a normalized dataset.
7. Export as **JSON** or **CSV**, or copy the JSON to the clipboard.

It does **not** attempt to bypass Reddit authentication, CAPTCHAs, API restrictions, deleted content, rate limits, or safety controls.

## Files

- `ultimate-reddit-extractor.js` — the complete userscript.
- `README.md` — installation, operation, output format, troubleshooting and limitations.

## Installation

### Recommended: Tampermonkey

1. Install Tampermonkey for your browser.
2. Create a new userscript.
3. Replace the template with the contents of `ultimate-reddit-extractor.js`.
4. Save it.
5. Open a Reddit post, for example a URL containing `/comments/<post-id>/`.
6. The **Reddit Extractor** panel appears in the lower-right corner.

The script has `@match` rules for:

- `https://www.reddit.com/*`
- `https://old.reddit.com/*`
- `https://new.reddit.com/*`

### Running from DevTools

The script can also be pasted into the browser console while viewing a Reddit post. In some browsers, DevTools prevents pasting by default; follow the browser's own safety prompt rather than disabling security features.

For repeated use, Tampermonkey is preferable because the script loads automatically.

## How it works

### 1. Detects the current thread

The script checks the current URL for a Reddit `/comments/<id>/` route and also checks Reddit's rendered post element for a post ID.

It will refuse to export if you are on a subreddit listing instead of a specific thread.

### 2. Reads post metadata

It collects the information available in the rendered post, including:

- post ID
- title
- author
- subreddit
- score, when exposed by the page
- upvote ratio, when exposed
- creation timestamp, when exposed
- reported comment count, when exposed
- canonical URL

### 3. Finds loaded comments

It supports several Reddit DOM representations, including current `shreddit-comment` elements and common `data-testid` comment containers.

The extractor also walks **open Shadow DOM roots** so that a component boundary does not automatically hide a comment from the scanner.

### 4. Extracts comment data

For each loaded comment it attempts to collect:

- comment ID
- parent comment ID
- author
- score
- depth
- whether the author matches the post author
- deleted state
- text body
- timestamp
- external links

Duplicate comment IDs are removed from the final result.

### 5. Exports the result

JSON is the primary format because it preserves the post, comments, metadata and nested relationship information.

CSV is provided for spreadsheet-style analysis and contains one row per extracted comment.

## Important: what "loaded" means

This tool does **not** pretend that a Reddit thread is complete when Reddit has not loaded all of its comments.

If Reddit currently shows 80 comments in the page but the thread reports 500 comments, the extractor will export the 80 comments that are actually available to the page and report a completeness estimate.

To collect more of a thread:

1. Let Reddit load the thread normally.
2. Expand/load more comments using Reddit's own controls.
3. Click **Scan loaded content** again.
4. Export the updated result.

This is deliberately different from the old version, which tried to automatically click Reddit's internal expansion controls and could become stuck, miss nested comments, or break when Reddit changed its frontend.

## Output example

```json
{
  "schema_version": "2.0",
  "tool_version": "2.0.0",
  "source": "Rendered/loaded Reddit page",
  "post": {
    "id": "abc123",
    "title": "Example thread",
    "author": "example_user",
    "subreddit": "r/example",
    "url": "https://www.reddit.com/r/example/comments/abc123/example/"
  },
  "comments": [
    {
      "id": "def456",
      "parent_id": null,
      "author": "commenter",
      "score": 12,
      "depth": 0,
      "is_op": false,
      "is_deleted": false,
      "content": "Example comment",
      "timestamp": "2026-08-14T10:00:00.000Z",
      "links": []
    }
  ],
  "stats": {
    "loaded_comments": 1,
    "reported_comment_count": 1,
    "completeness_estimate": "100%"
  }
}
```

## Why the old version failed

The previous implementation relied on several fragile assumptions:

- it automatically clicked Reddit's internal "more comments" controls;
- it assumed specific `faceplate-partial` URLs and shadow-DOM structures;
- it assumed all comments could be made available by repeatedly scrolling to the bottom;
- it used a fixed stale-attempt loop to decide when extraction was complete;
- it relied on a narrow set of comment body selectors;
- it could report a misleading percentage even when Reddit had not actually exposed all comments;
- it immediately downloaded a JSON file, leaving little opportunity to inspect what was extracted.

The new version separates **loading** from **extracting**. Reddit remains responsible for loading its own page, while the extractor only reads what is currently rendered/available and gives you explicit export controls.

## Current Reddit access restrictions

Reddit's current policies matter for this tool. Reddit says API access requires approval and that developers must comply with its Responsible Builder Policy, Developer Terms and Data API Terms. Reddit also says scraping Reddit without an authorized agreement is prohibited. This script therefore does not use an API key, bypass an access control, or attempt to evade Reddit's restrictions. Use it only in a way that is permitted for your account and use case.

If you need an application that accesses Reddit data programmatically rather than reading the current browser page, use Reddit's current Developer Platform/Data API process and obtain the required authorization.

## Troubleshooting

### Panel does not appear

- Make sure the userscript is enabled.
- Refresh the Reddit page.
- Open a specific post, not a subreddit home/listing.
- Check the userscript manager's console for errors.

### It says 0 comments

Reddit may not have rendered the comments yet. Wait for the thread to load and click **Scan loaded content** again.

### Some comments are missing

Expand/load more comments in Reddit itself, then scan again. Deleted, removed, collapsed, or not-yet-loaded content cannot be exported if it is not available to the page.

### CSV looks strange in Excel

The exporter quotes fields and uses UTF-8. If your spreadsheet application asks for an encoding, choose UTF-8.

## Version

**2.0.0 — rebuilt for reliability**

The extractor is intentionally conservative: it exports what the browser has actually loaded instead of trying to defeat Reddit's loading, authentication, rate-limit or anti-abuse mechanisms.
