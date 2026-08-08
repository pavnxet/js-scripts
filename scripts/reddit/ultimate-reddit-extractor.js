(async () => {
  console.log("🚀 Starting Ultimate Reddit Extractor (Bug-Free)...");

  // 1. AGGRESSIVE SANITIZATION HELPERS
  // Fixes the "trailing space" bug in keys and values
  const cleanStr = (val) => (val === null || val === undefined) ? null : String(val).trim();
  const cleanNum = (val) => {
    if (val === null || val === undefined || val === "") return null;
    const num = Number(String(val).trim());
    return isNaN(num) ? null : num;
  };

  // Recursively cleans all keys and values in the final object
  const sanitizeObject = (obj) => {
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (obj !== null && typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [cleanStr(k), sanitizeObject(v)])
      );
    }
    return obj;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 2. POST METADATA
  const postEl = document.querySelector("shreddit-post");
  if (!postEl) return console.error("❌ Not a valid thread page.");

  const postData = {
    id: cleanStr(postEl.getAttribute("thingid")),
    title: cleanStr(document.querySelector('h1[slot="title"]')?.innerText || document.title),
    author: cleanStr(postEl.getAttribute("author")),
    score: cleanNum(postEl.getAttribute("score")),
    upvote_ratio: cleanNum(postEl.getAttribute("upvote-ratio")),
    created: cleanStr(postEl.getAttribute("created-timestamp")),
    subreddit: cleanStr(postEl.getAttribute("subreddit-prefixed-name")),
    expected_comments: cleanNum(postEl.getAttribute("comment-count")),
    url: window.location.href
  };

  // 3. DEEP EXPANSION LOGIC (Fixes the 58% completeness bug)
  let previousCount = 0;
  let staleAttempts = 0;
  const MAX_STALE = 5;

  console.log("⏳ Expanding all hidden and nested threads...");
  while (staleAttempts < MAX_STALE) {
    window.scrollTo(0, document.body.scrollHeight); // Force lazy-load trigger
    await sleep(600);

    // Target ALL types of expansion triggers
    const targets = document.querySelectorAll(
      'shreddit-comment-tree-more-button, faceplate-partial[src*="more-comments"], a[slot="button"][href*="/comment/"]'
    );

    if (targets.length === 0) break;

    for (const target of targets) {
      try {
        const clickEl = target.shadowRoot?.querySelector("button") || target;
        clickEl.click();
      } catch (e) {}
    }

    let currentCount = document.querySelectorAll("shreddit-comment").length;
    let waitTime = 0;
    while (currentCount === previousCount && waitTime < 10000) {
      await sleep(500);
      waitTime += 500;
      currentCount = document.querySelectorAll("shreddit-comment").length;
    }

    if (currentCount === previousCount) {
      staleAttempts++;
    } else {
      staleAttempts = 0;
      previousCount = currentCount;
    }
  }

  // 4. ROBUST COMMENT EXTRACTION
  const comments = Array.from(document.querySelectorAll("shreddit-comment")).map((el) => {
    // Hierarchy
    let parentEl = el.parentElement;
    while (parentEl && parentEl.tagName !== "SHREDDIT-COMMENT") parentEl = parentEl.parentElement;

    // Content Extraction (Fixes empty content bug)
    let content = "";
    const selectors = ['div[id$="-rtjson-content"]', 'div[id$="-content"]', '[slot="text-body"]', ".md"];
    for (const sel of selectors) {
      const node = el.querySelector(sel);
      if (node && node.innerText.trim().length > 0) {
        content = node.innerText.trim();
        break;
      }
    }

    // Fallback: Clone DOM, strip UI elements, get raw text
    if (!content) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll("shreddit-comment-action-icons, shreddit-comment-tree-more-button, faceplate-partial, shreddit-async-loader, [slot=\"meta\"], [slot=\"author\"]").forEach((n) => n.remove());
      content = clone.innerText.trim();
    }

    const isDeleted = el.getAttribute("author") === "[deleted]" || el.hasAttribute("deleted");
    if (isDeleted && !content) content = "[deleted]";

    // Link Filtering (Removes spammy internal Reddit UI links)
    const rawLinks = Array.from(el.querySelectorAll("a[href]")).map((a) => cleanStr(a.href));
    const cleanLinks = rawLinks.filter((h) =>
      h &&
      !h.includes("javascript:") &&
      !h.includes("/user/") &&
      !h.includes("/r/") &&
      !h.includes("/comments/") &&
      !h.includes("reddit.com")
    );

    return {
      id: cleanStr(el.getAttribute("thingid")),
      parent_id: parentEl ? cleanStr(parentEl.getAttribute("thingid")) : null,
      author: cleanStr(el.getAttribute("author")),
      score: cleanNum(el.getAttribute("score")),
      depth: cleanNum(el.getAttribute("depth")),
      is_op: cleanStr(el.getAttribute("author")) === postData.author,
      is_deleted: isDeleted,
      content: content,
      timestamp: cleanStr(el.querySelector("time")?.getAttribute("datetime")),
      links: cleanLinks
    };
  });

  // 5. FINAL EXPORT & DOWNLOAD
  const finalExport = sanitizeObject({
    post: postData,
    comments: comments,
    stats: {
      total_extracted: comments.length,
      expected: postData.expected_comments,
      completeness: `${Math.round((comments.length / (postData.expected_comments || comments.length)) * 100)}%`,
      extracted_at: new Date().toISOString()
    }
  });

  const sub = (postData.subreddit || "unknown").replace("/r/", "").replace(/\s+/g, "");
  const slug = (postData.title || "thread").toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 40);
  const filename = `reddit_${sub}_${postData.id || Date.now()}.json`;

  const blob = new Blob([JSON.stringify(finalExport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);

  console.log(`✅ SUCCESS! Extracted ${comments.length} comments. File: ${filename}`);
})().catch((err) => console.error("❌ Fatal Error:", err));
