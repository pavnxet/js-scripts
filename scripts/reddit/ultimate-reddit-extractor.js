// ==UserScript==
// @name         Reddit Thread Extractor — Auto Expand Replies
// @namespace    js-scripts
// @version      3.0.0
// @description  Expand visible Reddit reply controls, wait for newly loaded replies, then extract the loaded thread with progress reporting.
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @match        https://new.reddit.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '3.0.0';
  const PANEL_ID = 'js-scripts-reddit-extractor';
  const MAX_ROUNDS = 80;
  const state = { data: null, running: false };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = v => v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  const num = v => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
  const uniq = a => [...new Set(a.filter(Boolean))];

  function deepQueryAll(selectors) {
    const selector = selectors.join(','), out = [];
    const walk = root => {
      if (!root?.querySelectorAll) return;
      out.push(...root.querySelectorAll(selector));
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(document);
    return [...new Set(out)];
  }

  function allDeep(root = document) {
    const out = [];
    const walk = node => {
      if (!node?.querySelectorAll) return;
      for (const el of node.querySelectorAll('*')) { out.push(el); if (el.shadowRoot) walk(el.shadowRoot); }
    };
    walk(root); return out;
  }

  function getPostId() {
    const m = location.pathname.match(/\/comments\/([a-z0-9]+)/i);
    if (m) return m[1];
    const el = document.querySelector('shreddit-post[thingid],shreddit-post[id],[data-testid="post-container"],.thing.link');
    return el?.getAttribute('thingid') || el?.getAttribute('id')?.replace(/^t3_/, '') || el?.dataset?.postId || null;
  }

  function getPost() {
    const el = document.querySelector('shreddit-post[thingid],shreddit-post[post-id],article[data-testid="post-container"],div[data-testid="post-container"],.thing.link');
    const attr = n => el?.getAttribute(n);
    const title = clean(el?.querySelector('h1[slot="title"],h1,a.title')?.textContent || document.querySelector('h1[slot="title"],h1,a.title')?.textContent || document.title.replace(/\s*:\s*Reddit.*$/i, ''));
    const author = clean(attr('author') || el?.querySelector('[data-testid="post_author_link"],a[href*="/user/"],.author')?.textContent);
    const subreddit = clean(attr('subreddit-prefixed-name') || document.querySelector('a[href*="/r/"],.subreddit')?.textContent);
    return { id: clean(attr('thingid')) || getPostId(), title, author: author || null, subreddit: subreddit || null, score: num(attr('score')), upvote_ratio: num(attr('upvote-ratio')), created: attr('created-timestamp') || null, comment_count_reported: num(attr('comment-count')), url: document.querySelector('link[rel="canonical"]')?.href || location.href };
  }

  function commentElements() {
    return deepQueryAll(['shreddit-comment[thingid]','shreddit-comment[id]','[data-testid="comment"]','div[data-testid="comment"]','.thing.comment']).filter(el => {
      const id = el.getAttribute('thingid') || el.getAttribute('id') || el.dataset?.commentId || el.dataset?.fullName;
      return !!id;
    });
  }

  function idOf(el) { return clean(el.getAttribute('thingid') || el.dataset?.commentId || el.dataset?.fullName || el.getAttribute('id')).replace(/^t1_/i, '') || null; }

  function parentOf(el) {
    const direct = el.getAttribute('parentid') || el.getAttribute('parent-id') || el.dataset?.parentId;
    if (direct) return clean(direct).replace(/^t[13]_/, '');
    let p = el.parentElement;
    while (p) {
      if (p.matches?.('shreddit-comment[thingid],shreddit-comment[id],[data-testid="comment"],div[data-testid="comment"],.thing.comment')) return idOf(p);
      p = p.parentElement;
    }
    return null;
  }

  function bodyOf(el) {
    for (const selector of ['[slot="comment"]','[slot="text-body"]','[id$="-rtjson-content"]','[id$="-content"]','.md','[data-testid="comment-content"]','.RichTextJSON-root']) {
      const n = el.querySelector?.(selector), value = clean(n?.innerText || n?.textContent);
      if (value) return value;
    }
    return '';
  }

  function linksOf(el) {
    return uniq([...el.querySelectorAll?.('a[href]') || []].map(a => {
      try { const u = new URL(a.href, location.href); return /^https?:$/i.test(u.protocol) && !/(^|\.)reddit\.com$/i.test(u.hostname) && !u.hostname.endsWith('.reddit.com') ? u.href : ''; } catch { return ''; }
    }));
  }

  function commentData(el, post) {
    const author = clean(el.getAttribute('author') || el.querySelector?.('[slot="author"],a[href*="/user/"],.author')?.textContent);
    const content = bodyOf(el);
    return { id: idOf(el), parent_id: parentOf(el), author: author || null, score: num(el.getAttribute('score') || el.querySelector?.('[score]')?.getAttribute('score')), depth: num(el.getAttribute('depth')), is_op: !!author && !!post.author && author === post.author, is_deleted: author === '[deleted]' || el.hasAttribute('deleted'), content: content || (author === '[deleted]' ? '[deleted]' : ''), timestamp: el.querySelector?.('time')?.getAttribute('datetime') || el.getAttribute('created-timestamp') || null, links: linksOf(el) };
  }

  function extract() {
    const post = getPost();
    if (!post.id) throw new Error('Open a specific Reddit post/thread first.');
    const comments = [], seen = new Set();
    for (const el of commentElements()) {
      const c = commentData(el, post);
      if (!c.id || seen.has(c.id)) continue;
      seen.add(c.id); comments.push(c);
    }
    const expected = post.comment_count_reported;
    const completeness = expected > 0 ? Math.min(100, Math.round(comments.length / expected * 100)) : null;
    return { schema_version: '3.0', tool_version: VERSION, source: 'Rendered Reddit page', post, comments, stats: { loaded_comments: comments.length, reported_comment_count: expected, completeness_estimate: completeness == null ? null : `${completeness}%`, exported_at: new Date().toISOString() } };
  }

  function expandableControls() {
    const patterns = [/^(view|load|show)\s+(\d+\s+)?(more\s+)?(repl(?:y|ies)|comments?)/i,/^(more|continue)\s+(repl(?:y|ies)|comments?)/i,/^(view|load|show)\s+more$/i,/^(continue this thread|view more replies)$/i];
    return allDeep().filter(el => {
      if (!(el instanceof HTMLElement) || el.closest(`#${PANEL_ID}`) || el.offsetParent === null) return false;
      const tag = el.tagName.toLowerCase(), role = el.getAttribute('role');
      const clickable = ['button','a'].includes(tag) || role === 'button' || typeof el.onclick === 'function';
      if (!clickable) return false;
      const label = clean(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title'));
      return label && patterns.some(p => p.test(label));
    });
  }

  async function autoExpand() {
    let clicks = 0, stable = 0, previous = commentElements().length;
    for (let round = 1; round <= MAX_ROUNDS && state.running; round++) {
      const controls = expandableControls();
      progress(round, MAX_ROUNDS, `Expanding replies · ${clicks} controls clicked · ${previous} comments loaded`);
      if (!controls.length) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await sleep(650);
      } else {
        for (const control of controls.slice(0, 12)) {
          if (!state.running) break;
          try { control.scrollIntoView({ block: 'center', behavior: 'instant' }); await sleep(70); control.click(); clicks++; await sleep(250); } catch {}
        }
        await sleep(850);
      }
      const now = commentElements().length;
      if (now === previous && !expandableControls().length) stable++; else stable = 0;
      previous = now;
      if (stable >= 3) break;
    }
    return { clicks, loaded: commentElements().length };
  }

  function download(name, content, type) { const blob = new Blob([content], {type}), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }
  const slug = v => clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'thread';
  const csvCell = v => `"${(Array.isArray(v)?v.join(' | '):v??'').toString().replace(/"/g,'""')}"`;
  function toCSV(data) { const rows=[['id','parent_id','author','score','depth','is_op','is_deleted','timestamp','content','links']]; data.comments.forEach(c=>rows.push([c.id,c.parent_id,c.author,c.score,c.depth,c.is_op,c.is_deleted,c.timestamp,c.content,c.links])); return rows.map(r=>r.map(csvCell).join(',')).join('\r\n'); }

  function status(message, kind='') { const el=document.querySelector(`#${PANEL_ID} .rxe-status`); if(el){el.textContent=message;el.dataset.kind=kind;} }
  function progress(value,max,message) { const bar=document.querySelector(`#${PANEL_ID} .rxe-progress-bar`), label=document.querySelector(`#${PANEL_ID} .rxe-progress-label`); if(bar)bar.style.width=`${Math.max(0,Math.min(100,value/max*100))}%`; if(label)label.textContent=message; }
  function buttons(disabled) { document.querySelectorAll(`#${PANEL_ID} button`).forEach(b=>b.disabled=disabled); }

  async function start() {
    if(state.running)return; state.running=true; buttons(true); progress(0,MAX_ROUNDS,'Preparing thread…');
    try {
      if(!getPostId()) throw new Error('Open a specific Reddit post/thread first.');
      window.scrollTo({top:0,behavior:'instant'}); await sleep(300);
      progress(1,MAX_ROUNDS,`Scanning thread · ${commentElements().length} comments initially loaded`);
      await autoExpand();
      progress(MAX_ROUNDS-1,MAX_ROUNDS,'Final scan…'); await sleep(300);
      state.data=extract();
      const expected=state.data.stats.reported_comment_count, suffix=expected?` · ${state.data.stats.completeness_estimate} of Reddit's reported count`:'';
      status(`Ready · ${state.data.comments.length} comments${suffix}`,'ok'); progress(MAX_ROUNDS,MAX_ROUNDS,`Complete · ${state.data.comments.length} comments found`);
    } catch(e) { console.error('[Reddit Extractor]',e); status(e.message||'Extraction failed','error'); progress(0,MAX_ROUNDS,'Failed'); }
    finally {state.running=false;buttons(false);}
  }

  function dataOrRun(){ if(state.data)return state.data; try{state.data=extract();return state.data;}catch(e){status(e.message,'error');return null;} }
  function json(){const d=dataOrRun();if(!d)return;download(`reddit_${slug(d.post.subreddit)}_${d.post.id||Date.now()}.json`,JSON.stringify(d,null,2),'application/json;charset=utf-8');}
  function csv(){const d=dataOrRun();if(!d)return;download(`reddit_${slug(d.post.subreddit)}_${d.post.id||Date.now()}_comments.csv`,toCSV(d),'text/csv;charset=utf-8');}
  async function copy(){const d=dataOrRun();if(!d)return;try{await navigator.clipboard.writeText(JSON.stringify(d,null,2));status('JSON copied to clipboard','ok');}catch{status('Clipboard permission denied','error');}}

  function createPanel() {
    if(document.getElementById(PANEL_ID))return;
    const style=document.createElement('style'); style.textContent=`#${PANEL_ID}{position:fixed;right:18px;bottom:18px;width:330px;z-index:2147483647;font:13px/1.45 system-ui,sans-serif;color:#18181b}#${PANEL_ID}*{box-sizing:border-box}.rxe-card{background:#fff;border:1px solid #e4e4e7;border-radius:14px;box-shadow:0 18px 50px #0003;overflow:hidden}.rxe-head{padding:13px 15px;border-bottom:1px solid #e4e4e7;display:flex;justify-content:space-between}.rxe-title{font-weight:750}.rxe-version{font-size:10px;color:#71717a}.rxe-body{padding:13px}.rxe-help{font-size:11px;color:#71717a;margin-bottom:10px}.rxe-progress{height:9px;background:#e4e4e7;border-radius:99px;overflow:hidden}.rxe-progress-bar{height:100%;width:0;background:#18181b;transition:width .2s}.rxe-progress-label{font-size:10px;color:#71717a;margin:6px 0 11px}.rxe-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rxe-actions button{min-height:34px;border:1px solid #d4d4d8;background:#fff;border-radius:8px;font:600 12px system-ui;color:#18181b;cursor:pointer}.rxe-actions .primary{grid-column:1/-1;background:#18181b;color:#fff;border-color:#18181b}.rxe-actions button:disabled{opacity:.5;cursor:not-allowed}.rxe-status{margin-top:9px;padding:8px;background:#f4f4f5;border-radius:8px;font-size:11px;color:#52525b}.rxe-status[data-kind=ok]{background:#f0fdf4;color:#166534}.rxe-status[data-kind=error]{background:#fef2f2;color:#991b1b}@media(max-width:600px){#${PANEL_ID}{left:12px;right:12px;width:auto}}`; document.head.appendChild(style);
    const p=document.createElement('div'); p.id=PANEL_ID; p.innerHTML=`<div class="rxe-card"><div class="rxe-head"><div class="rxe-title">Reddit Extractor</div><div class="rxe-version">v${VERSION}</div></div><div class="rxe-body"><div class="rxe-help">Automatically expands visible reply/load-more controls, waits for new replies, then extracts the thread.</div><div class="rxe-progress"><div class="rxe-progress-bar"></div></div><div class="rxe-progress-label">Ready</div><div class="rxe-actions"><button class="primary" data-action="start">Expand replies + extract</button><button data-action="json">↓ JSON</button><button data-action="csv">↓ CSV</button><button data-action="copy">Copy JSON</button></div><div class="rxe-status">Ready — open a Reddit post.</div></div></div>`;
    document.body.appendChild(p); p.addEventListener('click',e=>{const a=e.target.closest('button')?.dataset.action;if(a==='start')start();if(a==='json')json();if(a==='csv')csv();if(a==='copy')copy();});
  }
  createPanel();
})();
