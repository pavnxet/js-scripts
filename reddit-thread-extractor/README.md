# Reddit Thread Extractor — Auto Expand Replies

Version **3.1.0**.

This is a browser-side Tampermonkey userscript for extracting a Reddit post together with its **loaded comments and nested replies**. Before exporting, it automatically looks for visible Reddit controls such as **View more replies**, **Load more comments**, **Continue this thread**, and similar controls, clicks them in batches, waits for new content, rescans, and repeats until the page becomes stable or the safety round limit is reached.

## What changed in v3.1

Version 3.1 adds a complete **post metadata object** to the export. The extractor now saves information about the post itself before saving its comments.

### Post metadata

When Reddit exposes the information in the rendered page, the export includes:

- post ID
- title
- author
- subreddit
- canonical URL / permalink
- post body
- score
- upvote ratio
- Reddit's reported comment count
- creation timestamp
- flair
- NSFW flag
- spoiler flag
- links contained in the post

Fields that Reddit does not expose to the page are stored as `null` rather than guessed.

## Complete workflow

```text
Open Reddit post
      ↓
Click “Expand replies + extract”
      ↓
Read post metadata
      ↓
Detect visible reply/load-more controls
      ↓
Click a small batch of controls
      ↓
Wait for Reddit to render new replies
      ↓
Rescan the DOM
      ↓
Repeat until stable
      ↓
Final extraction of post + comments
      ↓
JSON / CSV / Copy
```

A **live progress bar** is shown throughout the process. It reports the current phase, number of controls clicked, and number of comments currently detected.

## Installation

### Tampermonkey

1. Install Tampermonkey.
2. Create a new userscript.
3. Copy `ultimate-reddit-extractor.js` into it.
4. Save and enable the script.
5. Open a specific Reddit post/thread containing `/comments/<post-id>/`.
6. A **Reddit Extractor** panel appears in the lower-right corner.
7. Click **Expand replies + extract**.

The script matches:

- `https://www.reddit.com/*`
- `https://old.reddit.com/*`
- `https://new.reddit.com/*`

## How automatic reply expansion works

The script searches the rendered page, including **open Shadow DOM roots**, for clickable elements whose visible text or accessibility label looks like a reply/comment expansion control.

Examples it recognizes include patterns similar to:

- `View more replies`
- `View 5 more replies`
- `Load more replies`
- `Show more comments`
- `Continue this thread`
- `More replies`

When a control is found:

1. It is scrolled into view.
2. The extractor clicks it.
3. It waits for Reddit to render the response.
4. The comment count is measured again.
5. Newly exposed controls are discovered.
6. The process repeats.

Only a small batch of controls is clicked per round. This prevents the script from firing hundreds of clicks at once and gives Reddit time to update the DOM.

## Progress bar

The panel displays progress such as:

```text
[██████████████░░░░░░] 70%
Expanding replies · 34 controls clicked · 428 comments loaded
```

At the end it changes to:

```text
Complete · 512 comments found
```

The percentage represents the extractor's **expansion rounds**, not a claim that Reddit has exposed a mathematically exact percentage of all comments. Reddit's reported comment count is shown separately when the page exposes it.

## What counts as a complete extraction?

The extractor considers the page stable when it has repeatedly found no new expandable controls and the number of detected comments stops increasing.

There is a safety limit of **80 expansion rounds**. This prevents a broken Reddit control, endlessly changing page, or unusual thread from causing an infinite loop.

If Reddit still has inaccessible/collapsed content after that point, the export contains everything the browser made available to the script.

## Post data

The JSON export has a top-level `post` object. A simplified example is:

```json
{
  "post": {
    "id": "abc123",
    "title": "Example Reddit post",
    "author": "example_user",
    "subreddit": "r/AskReddit",
    "url": "https://www.reddit.com/r/AskReddit/comments/abc123/example/",
    "permalink": "https://www.reddit.com/r/AskReddit/comments/abc123/example/",
    "body": "The post body, when available",
    "score": 1234,
    "upvote_ratio": 0.95,
    "comment_count_reported": 567,
    "created_at": "2026-08-14T10:30:00Z",
    "flair": "Discussion",
    "is_nsfw": false,
    "is_spoiler": false,
    "links": []
  }
}
```

The extractor does **not** invent missing metadata. If Reddit's current rendered page does not expose a field, that field is `null` or an empty array as appropriate.

## Nested replies

Yes. Nested replies are treated as individual comments.

Each comment contains relationship information such as:

```json
{
  "id": "reply123",
  "parent_id": "comment456",
  "depth": 2,
  "content": "This is a nested reply"
}
```

This means a downstream program can reconstruct the conversation tree using `parent_id` and `depth`.

Example:

```text
Comment A
├── Reply A1
│   ├── Reply A1.1
│   └── Reply A1.2
└── Reply A2
```

The extractor does not flatten the relationship into a single text block.

## What the extractor collects

### Post

- ID
- title
- author
- subreddit
- canonical URL / permalink
- body
- score, when exposed
- upvote ratio, when exposed
- creation timestamp, when exposed
- Reddit's reported comment count, when exposed
- flair, when exposed
- NSFW status
- spoiler status
- links

### Comment / reply

- comment ID
- parent comment ID
- author
- score, when exposed
- depth, when exposed
- OP indicator
- deleted indicator
- text content
- timestamp
- external links

Duplicate comment IDs are removed.

## Export formats

### JSON

Recommended format. It preserves the complete `post` object, `comments` array, parent relationships and extraction statistics.

### CSV

One row per extracted comment. The CSV includes the important post metadata on every comment row so it remains useful when imported into Excel, Google Sheets, Python, pandas, or another analysis tool.

CSV post columns include:

```text
post_id
post_title
post_author
subreddit
post_url
post_created_at
post_score
post_upvote_ratio
post_flair
```

Comment columns then include the comment/reply information.

### Copy JSON

Copies the complete JSON result to the clipboard.

## Output schema

The current export uses `schema_version: "3.1"` and contains:

```text
schema_version
tool_version
source
post
comments[]
stats
```

The important relationship fields are:

```text
comments[].id
comments[].parent_id
comments[].depth
```

## Important limitation

The script can only expand controls that are actually available to the browser.

It does **not**:

- use Reddit API credentials;
- bypass authentication;
- bypass CAPTCHAs;
- bypass rate limits;
- access deleted content that Reddit does not expose;
- defeat access controls;
- manufacture replies that Reddit has not provided to the page.

For example, if Reddit never exposes a particular reply because it is deleted, removed, unavailable to the account, or behind an access mechanism the page cannot use, the extractor cannot legitimately retrieve it.

## Why the progress bar may stop below 100%

The progress bar is based on the expansion process. It is intentionally **not** calculated as:

```text
extracted comments / reported comments
```

because Reddit's reported count and rendered comment count can represent different things, especially with deleted/removed comments and dynamic loading.

The final status separately reports the number of comments found and, when available, an estimated comparison with Reddit's reported count.

## Safety and policy

This tool is intentionally browser-side and conservative. It reads the Reddit page that the user is already viewing and interacts with visible page controls. It does not attempt to bypass Reddit's authentication, API restrictions, CAPTCHA, rate limits, or other access controls.

Reddit's current policies and terms should be checked before using extracted data for any automated, commercial, or large-scale purpose.

## Troubleshooting

### The panel does not appear

- Make sure Tampermonkey is enabled.
- Refresh the Reddit post.
- Check that the URL is a specific post/thread.
- Check the userscript manager for JavaScript errors.

### It finds the main comments but not some replies

Try scrolling through the thread once and run **Expand replies + extract** again. Reddit can use different controls depending on the thread, account, experiment, or page state.

### The progress bar stops

The script intentionally has a maximum of 80 rounds. If Reddit continues changing the page indefinitely, the extractor stops safely and exports the content it could detect.

### Some replies are still missing

Those replies may be:

- not exposed by Reddit;
- behind a control whose wording/structure is not recognized by the current version;
- deleted or removed;
- unavailable to the current account;
- not loaded because Reddit stopped responding to further expansion.

### Export says 0 comments

Wait until Reddit has rendered the thread and run the extraction again.

## Version history

### 3.1.0

- added complete post metadata extraction
- added post body, flair, permalink, NSFW/spoiler status and post links when exposed
- JSON schema updated to `3.1`
- CSV now carries key post metadata on every comment row
- retained automatic reply expansion and live progress reporting

### 3.0.0

- automatic visible reply expansion
- automatic `load more`/`continue thread` detection
- repeated rescanning after Reddit updates the page
- live progress bar
- expansion round safety limit
- nested reply preservation
- improved Shadow DOM scanning
- JSON / CSV / clipboard export retained

### 2.x

The previous version only extracted content that was already loaded and required the user to expand additional comments manually.
