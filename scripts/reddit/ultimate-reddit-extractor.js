// ==UserScript==
// @name         Reddit Thread Extractor — Loaded Content
// @namespace    js-scripts
// @version      2.0.1
// @description  Export the Reddit post and comments currently loaded in the page as JSON or CSV.
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @match        https://new.reddit.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // Browser-side extractor for content already loaded in the current Reddit page.
  // It does not bypass authentication, CAPTCHAs, rate limits, deleted content,
  // API restrictions, or Reddit safety controls.

  const VERSION = '2.0.1';
  const PANEL_ID = 'js-scripts-reddit-extractor';
  const state = { lastExport: null, observer: null };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = value => value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
  const number = value => {
    if (value == null || value === '') return null;
    const n = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  };
  const unique = values => [...new Set(values.filter(Boolean))];

  function allElements(root = document) {
    const result = [];
    const visit = node => {
      if (!node || !node.querySelectorAll) return;
      for (const el of node.querySelectorAll('*')) {
        result.push(el);
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(root);
    return result;
  }

  function queryAllDeep(selectors) {
    const found = [];
    const selector = selectors.join(',');
    const walk = root => {
      if (!root || !root.querySelectorAll) return;
      found.push(...root.querySelectorAll(selector));
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return [...new Set(found)];
  }

  function getPostId() {
    const match = location.pathname.match(/\/comments\/([a-z0-9]+)/i);
    if (match) return match[1];
    const post = document.querySelector('shreddit-post[thingid], shreddit-post[id], [data-testid="post-container"], .thing.link');
    return post?.getAttribute('thingid') ||
      post?.getAttribute('id')?.replace(/^t3_/, '') ||
      post?.dataset?.postId || null;
  }

  function getPostElement() {
    return document.querySelector(
      'shreddit-post[thingid], shreddit-post[post-id], article[data-testid="post-container"], div[data-testid="post-container"], .thing.link'
    );
  }

  function getPostData() {
    const el = getPostElement();
    const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
    const attr = name => el?.getAttribute(name);
    const title = text(
      el?.querySelector('h1[slot="title"], h1, a.title')?.textContent ||
      document.querySelector('h1[slot="title"], h1, a.title')?.textContent ||
      document.title.replace(/\s*:\s*Reddit.*$/i, '')
    );
    const author = text(attr('author')) || text(document.querySelector('[data-testid="post_author_link"], a[href*="/user/"], .author')?.textContent);
    const subreddit = text(attr('subreddit-prefixed-name')) || text(document.querySelector('a[href*="/r/"], .subreddit')?.textContent);

    return {
      id: text(attr('thingid')) || getPostId(),
      title,
      author: author || null,
      subreddit: subreddit || null,
      score: number(attr('score')),
      upvote_ratio: number(attr('upvote-ratio')),
      created: attr('created-timestamp') || null,
      comment_count_reported: number(attr('comment-count')),
      url: canonical,
      extracted_at: new Date().toISOString()
    };
  }

  function getCommentElements() {
    const selectors = [
      'shreddit-comment[thingid]',
      'shreddit-comment[id]',
      '[data-testid="comment"]',
      'div[data-testid="comment"]',
      '.thing.comment'
    ];
    return queryAllDeep(selectors).filter(el => {
      const id = el.getAttribute('thingid') || el.getAttribute('id') || el.dataset?.commentId || el.dataset?.fullName;
      return Boolean(id && (/^t1_/i.test(id) || /comment/i.test(el.className || '') || el.matches('shreddit-comment, [data-testid="comment"], div[data-testid="comment"]')));
    });
  }

  function commentId(el) {
    return text(el.getAttribute('thingid')) ||
      text(el.dataset?.commentId) ||
      text(el.dataset?.fullName)?.replace(/^t1_/, '') ||
      text(el.getAttribute('id')).replace(/^t1_/, '') || null;
  }

  function parentId(el) {
    const explicit = el.getAttribute('parentid') || el.getAttribute('parent-id') || el.dataset?.parentId;
    if (explicit) return explicit.replace(/^t1_/, '').replace(/^t3_/, '');

    let parent = el.parentElement;
    while (parent) {
      if (parent.matches?.('shreddit-comment[thingid], shreddit-comment[id], [data-testid="comment"], div[data-testid="comment"], .thing.comment')) {
        return commentId(parent);
      }
      parent = parent.parentElement;
    }
    return null;
  }

  function commentContent(el) {
    const selectors = [
      '[slot="comment"]',
      '[slot="text-body"]',
      '[id$="-rtjson-content"]',
      '[id$="-content"]',
      '.md',
      '[data-testid="comment-content"]',
      '.RichTextJSON-root'
    ];

    for (const selector of selectors) {
      const node = el.querySelector?.(selector);
      const value = text(node?.innerText || node?.textContent);
      if (value) return value;
    }

    for (const node of allElements(el)) {
      const value = text(node.innerText || node.textContent);
      if (value && value.length > 1 && value.length < 20000 && /[a-zA-Z0-9\u0900-\u097F]/.test(value)) {
        if (!/^(Reply|Share|Report|Save|Follow|More|Collapse)$/i.test(value)) return value;
      }
    }
    return '';
  }

  function commentLinks(el) {
    const anchors = el.querySelectorAll?.('a[href]') || [];
    return unique([...anchors].map(a => {
      try { return new URL(a.href, location.href).href; } catch { return ''; }
    }).filter(href => {
      if (!href || !/^https?:/i.test(href)) return false;
      try {
        const u = new URL(href);
        return u.hostname !== 'reddit.com' && !u.hostname.endsWith('.reddit.com');
      } catch { return false; }
    }));
  }

  function getCommentData(el, post) {
    const author = text(el.getAttribute('author')) ||
      text(el.querySelector?.('[slot="author"], a[href*="/user/"], .author')?.textContent);
    const body = commentContent(el);
    const deleted = author === '[deleted]' || el.hasAttribute('deleted') || /\[deleted\]/i.test(body);

    return {
      id: commentId(el),
      parent_id: parentId(el),
      author: author || null,
      score: number(el.getAttribute('score') || el.querySelector?.('[score]')?.getAttribute('score')),
      depth: number(el.getAttribute('depth')),
      is_op: Boolean(author && post.author && author === post.author),
      is_deleted: deleted,
      content: body || (deleted ? '[deleted]' : ''),
      timestamp: el.querySelector?.('time')?.getAttribute('datetime') || el.getAttribute('created-timestamp') || null,
      links: commentLinks(el)
    };
  }

  function extract() {
    const post = getPostData();
    if (!post.id) throw new Error('Open a Reddit post/thread first. A subreddit listing is not a thread.');

    const seen = new Set();
    const comments = [];
    for (const el of getCommentElements()) {
      const item = getCommentData(el, post);
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      comments.push(item);
    }

    const expected = post.comment_count_reported;
    const completeness = expected && expected > 0 ? Math.min(100, Math.round(comments.length / expected * 100)) : null;

    return {
      schema_version: '2.0',
      tool_version: VERSION,
      source: 'Rendered/loaded Reddit page',
      post,
      comments,
      stats: {
        loaded_comments: comments.length,
        reported_comment_count: expected,
        completeness_estimate: completeness == null ? null : `${completeness}%`,
        note: 'Only comments currently loaded in the page are exported. Expand/load more comments in Reddit and scan again for additional content.'
      },
      exported_at: new Date().toISOString()
    };
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function slug(value) {
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'thread';
  }

  function csvCell(value) {
    const str = Array.isArray(value) ? value.join(' | ') : value == null ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  }

  function toCSV(data) {
    const rows = [['id','parent_id','author','score','depth','is_op','is_deleted','timestamp','content','links']];
    for (const c of data.comments) rows.push([c.id, c.parent_id, c.author, c.score, c.depth, c.is_op, c.is_deleted, c.timestamp, c.content, c.links]);
    return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  function setStatus(message, kind = '') {
    const status = document.querySelector(`#${PANEL_ID} .rxe-status`);
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function runExtract() {
    try {
      const data = extract();
      state.lastExport = data;
      const suffix = data.stats.completeness_estimate ? ` · ${data.stats.completeness_estimate} of reported count` : '';
      setStatus(`Loaded ${data.comments.length} comments${suffix}`, 'ok');
      return data;
    } catch (error) {
      setStatus(error.message || 'Extraction failed', 'error');
      console.error('[Reddit Extractor]', error);
      return null;
    }
  }

  function getData() { return state.lastExport || runExtract(); }

  function downloadJSON() {
    const data = getData();
    if (!data) return;
    const name = `reddit_${slug(data.post.subreddit)}_${data.post.id || Date.now()}.json`;
    download(name, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
    setStatus(`Downloaded ${name}`, 'ok');
  }

  function downloadCSV() {
    const data = getData();
    if (!data) return;
    const name = `reddit_${slug(data.post.subreddit)}_${data.post.id || Date.now()}_comments.csv`;
    download(name, toCSV(data), 'text/csv;charset=utf-8');
    setStatus(`Downloaded ${name}`, 'ok');
  }

  async function copyJSON() {
    const data = getData();
    if (!data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setStatus('JSON copied to clipboard', 'ok');
    } catch {
      setStatus('Clipboard permission was denied', 'error');
    }
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const style = document.createElement('style');
    style.textContent = `
      #${PANEL_ID}{position:fixed;right:18px;bottom:18px;width:310px;z-index:2147483647;font:13px/1.45 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .rxe-card{background:#fff;border:1px solid #e4e4e7;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.18);overflow:hidden}
      #${PANEL_ID} .rxe-head{padding:14px 15px;border-bottom:1px solid #e4e4e7;display:flex;align-items:center;justify-content:space-between}
      #${PANEL_ID} .rxe-title{font-weight:750}#${PANEL_ID} .rxe-version{font-size:10px;color:#71717a}
      #${PANEL_ID} .rxe-body{padding:14px}.rxe-help{font-size:11px;color:#71717a;margin-bottom:12px}
      #${PANEL_ID} button{appearance:none;border:1px solid #d4d4d8;background:#fff;color:#18181b;border-radius:8px;min-height:34px;padding:0 10px;font:600 12px inherit;cursor:pointer;transition:.15s}
      #${PANEL_ID} button:hover{background:#f4f4f5;transform:translateY(-1px)}#${PANEL_ID} .primary{background:#18181b;color:#fff;border-color:#18181b}
      #${PANEL_ID} .rxe-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rxe-actions button:first-child{grid-column:1/-1}
      #${PANEL_ID} .rxe-status{margin-top:10px;padding:8px 9px;border-radius:8px;background:#f4f4f5;color:#52525b;font-size:11px}
      #${PANEL_ID} .rxe-status[data-kind=ok]{color:#166534;background:#f0fdf4}#${PANEL_ID} .rxe-status[data-kind=error]{color:#991b1b;background:#fef2f2}
      @media(max-width:600px){#${PANEL_ID}{left:12px;right:12px;bottom:12px;width:auto}}
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="rxe-card">
        <div class="rxe-head"><div class="rxe-title">Reddit Extractor</div><div class="rxe-version">v${VERSION}</div></div>
        <div class="rxe-body">
          <div class="rxe-help">Reads the post and comments already loaded in this Reddit page. Expand/load more comments in Reddit, then scan again.</div>
          <div class="rxe-actions">
            <button class="primary" data-action="extract">↻ Scan loaded content</button>
            <button data-action="json">↓ JSON</button>
            <button data-action="csv">↓ CSV</button>
            <button data-action="copy">Copy JSON</button>
          </div>
          <div class="rxe-status">Ready — open a Reddit post.</div>
        </div>
      </div>`;
    document.body.appendChild(panel);

    panel.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.action;
      if (action === 'extract') runExtract();
      if (action === 'json') downloadJSON();
      if (action === 'csv') downloadCSV();
      if (action === 'copy') copyJSON();
    });
  }

  async function init() {
    for (let i = 0; i < 20; i++) {
      if (document.body) break;
      await sleep(250);
    }
    if (!document.body) return;
    createPanel();
    const postId = getPostId();
    if (postId) setStatus(`Ready — post ${postId}`);

    // Reddit is a SPA. Keep the panel available after client-side navigation.
    state.observer = new MutationObserver(() => {
      if (!document.getElementById(PANEL_ID) && document.body) createPanel();
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  init().catch(error => console.error('[Reddit Extractor] init failed', error));
})();
