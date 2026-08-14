// ==UserScript==
// @name         Reddit Thread Extractor — Universal
// @namespace    js-scripts
// @version      4.0.0
// @description  Compatibility-first Reddit thread extractor with reply expansion, progress, metadata, tree reconstruction and JSON/CSV/Markdown exports.
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @match        https://new.reddit.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '4.0.0';
  const PANEL_ID = 'js-scripts-reddit-extractor';
  const MAX_ROUNDS = 120;
  const BATCH_SIZE = 8;
  const state = { running:false, paused:false, data:null, clicks:0, rounds:0, lastCount:0 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = v => v == null ? '' : String(v).replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
  const number = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(/,/g,'')); return Number.isFinite(n) ? n : null; };
  const unique = a => [...new Set((a || []).filter(Boolean))];
  const text = el => clean(el?.innerText || el?.textContent || '');
  const attr = (el, names) => { for (const n of names) { const v = el?.getAttribute?.(n); if (v) return v; } return ''; };
  const sleepUntil = async fn => { while (!fn()) await sleep(120); };

  function deepAll(root=document) {
    const out=[];
    const walk=r=>{ if(!r?.querySelectorAll) return; for(const el of r.querySelectorAll('*')) { out.push(el); if(el.shadowRoot) walk(el.shadowRoot); } };
    walk(root); return out;
  }
  function deepQuery(selectors) {
    const out=[]; const selector=selectors.join(',');
    const walk=r=>{ if(!r?.querySelectorAll) return; out.push(...r.querySelectorAll(selector)); for(const el of r.querySelectorAll('*')) if(el.shadowRoot) walk(el.shadowRoot); };
    walk(document); return [...new Set(out)];
  }
  function first(root, selectors) { for(const s of selectors){ const n=root?.querySelector?.(s); const v=text(n); if(v) return v; } return ''; }

  function postEl() {
    return document.querySelector('shreddit-post[thingid],shreddit-post[post-id],article[data-testid="post-container"],div[data-testid="post-container"],article[aria-label],.thing.link');
  }
  function postId() {
    const m=location.pathname.match(/\/comments\/([a-z0-9]+)/i); if(m) return m[1];
    const el=postEl(); return attr(el,['thingid','post-id']) || attr(el,['id']).replace(/^t3_/i,'') || el?.dataset?.postId || null;
  }
  function canonical() { return document.querySelector('link[rel="canonical"]')?.href || location.href.split('#')[0]; }
  function links(root, includeReddit=false) {
    return unique([...(root?.querySelectorAll?.('a[href]')||[])].map(a=>{ try { const u=new URL(a.href,location.href); if(!/^https?:$/i.test(u.protocol)) return ''; if(!includeReddit && (u.hostname==='reddit.com'||u.hostname.endsWith('.reddit.com'))) return ''; return u.href; } catch { return ''; } }));
  }
  function body(root) {
    const selectors=['[slot="text-body"]','[slot="comment"]','[data-testid="post-content"]','[data-testid="comment-content"]','[id$="-rtjson-content"]','[id$="-content"]','.RichTextJSON-root','.md'];
    return first(root,selectors);
  }

  function getPost() {
    const el=postEl(), id=postId(), title=clean(attr(el,['title']) || first(el,['h1[slot="title"]','h1','a.title']) || first(document,['h1[slot="title"]','h1','a.title']) || document.title.replace(/\s*:\s*Reddit.*$/i,''));
    const author=clean(attr(el,['author','author-name']) || first(el,['[data-testid="post_author_link"]','a[href*="/user/"]','.author']));
    const subreddit=clean(attr(el,['subreddit-prefixed-name','subreddit']) || first(el,['a[href*="/r/"]','.subreddit']) || first(document,['a[href*="/r/"]','.subreddit']));
    const created=attr(el,['created-timestamp','created']) || el?.querySelector?.('time')?.getAttribute('datetime') || null;
    return {
      id:id||null, title:title||null, author:author||null, subreddit:subreddit||null,
      url:canonical(), permalink:canonical(), body:body(el)||null,
      score:number(attr(el,['score']) || el?.querySelector?.('[score]')?.getAttribute('score')),
      upvote_ratio:number(attr(el,['upvote-ratio','upvote_ratio'])),
      comment_count_reported:number(attr(el,['comment-count','commentcount'])),
      created_at:created, flair:clean(attr(el,['flair-text']) || first(el,['[slot="post-flair"]','[data-testid="post-flair"]','.linkflairlabel'])) || null,
      is_nsfw:attr(el,['is-nsfw'])==='true' || !!el?.querySelector?.('[data-testid="post-nsfw"],span[title*="NSFW"]'),
      is_spoiler:attr(el,['is-spoiler'])==='true' || !!el?.querySelector?.('[data-testid="post-spoiler"],span[title*="Spoiler"]'),
      links:links(el,true)
    };
  }

  const COMMENT_SELECTORS=['shreddit-comment[thingid]','shreddit-comment[id]','[data-testid="comment"]','div[data-testid="comment"]','.thing.comment'];
  function commentEls() { return deepQuery(COMMENT_SELECTORS).filter(e=>idOf(e)); }
  function idOf(el) { return clean(attr(el,['thingid','comment-id']) || el.dataset?.commentId || el.dataset?.fullName || attr(el,['id'])).replace(/^t1_/i,'') || null; }
  function parentId(el) {
    const direct=attr(el,['parentid','parent-id']) || el.dataset?.parentId; if(direct) return clean(direct).replace(/^t[13]_/, '');
    let p=el.parentElement; while(p){ if(p.matches?.(COMMENT_SELECTORS.join(','))) return idOf(p); p=p.parentElement; }
    return null;
  }
  function commentDepth(el) {
    const d=number(attr(el,['depth'])); if(d!=null) return d;
    let p=el.parentElement, n=0; while(p){ if(p.matches?.(COMMENT_SELECTORS.join(','))) n++; p=p.parentElement; } return n;
  }
  function commentData(el, post) {
    const author=clean(attr(el,['author','author-name']) || first(el,['[slot="author"]','a[href*="/user/"]','.author']));
    const deleted=/^\[deleted\]$/i.test(author) || el.hasAttribute('deleted');
    return { id:idOf(el), parent_id:parentId(el), author:author||null, score:number(attr(el,['score']) || el.querySelector?.('[score]')?.getAttribute('score')), depth:commentDepth(el), is_op:!!author && !!post.author && author===post.author, is_deleted:deleted, content:body(el) || (deleted?'[deleted]':''), timestamp:el.querySelector?.('time')?.getAttribute('datetime') || attr(el,['created-timestamp','created']) || null, links:links(el) };
  }

  function extract() {
    const post=getPost(); if(!post.id) throw new Error('Open a specific Reddit post/thread first.');
    const comments=[], seen=new Set();
    for(const el of commentEls()){ const c=commentData(el,post); if(c.id && !seen.has(c.id)){seen.add(c.id);comments.push(c);} }
    comments.sort((a,b)=>(a.depth??999)-(b.depth??999));
    const expected=post.comment_count_reported;
    return { schema_version:'4.0', tool_version:VERSION, source:'Rendered Reddit page', extracted_at:new Date().toISOString(), post, comments,
      stats:{loaded_comments:comments.length, top_level_comments:comments.filter(c=>!c.parent_id).length, replies:comments.filter(c=>!!c.parent_id).length, max_depth:comments.reduce((m,c)=>Math.max(m,c.depth??0),0), reported_comment_count:expected, completeness_estimate:expected>0?`${Math.min(100,Math.round(comments.length/expected*100))}%`:null, expansion_clicks:state.clicks, expansion_rounds:state.rounds}
    };
  }

  function labelOf(el) { return clean(el.getAttribute?.('aria-label') || el.getAttribute?.('title') || text(el)); }
  function expandable() {
    const re=/(more\s+(repl(?:y|ies)|comments?)|view\s+(more|all)|load\s+(more|all)|show\s+(more|all)|continue\s+(this\s+)?thread|\d+\s+(more\s+)?repl(?:y|ies)|repl(?:y|ies)\s+\(\d+\))/i;
    return deepAll().filter(el=>{
      if(!(el instanceof HTMLElement) || el.closest(`#${PANEL_ID}`) || el.offsetParent===null) return false;
      const tag=el.tagName.toLowerCase(), role=el.getAttribute('role');
      if(!['button','a','summary'].includes(tag) && role!=='button') return false;
      const l=labelOf(el); return l && re.test(l) && !/share|report|award|reply$/i.test(l);
    });
  }

  async function waitForChange(before, timeout=2500) { const end=Date.now()+timeout; while(Date.now()<end){ if(commentEls().length>before) return true; await sleep(120); } return false; }
  async function expandAll() {
    let stable=0, previous=commentEls().length;
    for(let round=1;round<=MAX_ROUNDS && state.running;round++){
      state.rounds=round; while(state.paused && state.running) await sleep(200);
      const controls=[...new Set(expandable())];
      progress(round,MAX_ROUNDS,`Expanding replies · ${state.clicks} actions · ${previous} loaded`);
      if(!controls.length){ window.scrollTo({top:Math.min(document.body.scrollHeight,window.scrollY+Math.max(600,innerHeight*.9)),behavior:'smooth'}); await sleep(700); }
      else {
        let changed=false;
        for(const c of controls.slice(0,BATCH_SIZE)){
          if(!state.running) break; while(state.paused && state.running) await sleep(200);
          try { c.scrollIntoView({block:'center'}); await sleep(80); c.click(); state.clicks++; changed=await waitForChange(previous,1800)||changed; } catch {}
        }
        await sleep(500);
        if(changed) stable=0; else stable++;
      }
      const now=commentEls().length;
      if(now===previous && expandable().length===0) stable++; else if(now>previous) stable=0;
      previous=now; state.lastCount=now;
      if(stable>=4) break;
    }
    return {loaded:commentEls().length,clicks:state.clicks,rounds:state.rounds};
  }

  function csvCell(v){ return `"${String(Array.isArray(v)?v.join(' | '):v??'').replace(/"/g,'""')}"`; }
  function toCSV(d){
    const h=['post_id','post_title','post_author','subreddit','post_url','post_created_at','post_score','post_upvote_ratio','post_flair','comment_id','parent_id','author','score','depth','is_op','is_deleted','timestamp','content','links'];
    return [h,...d.comments.map(c=>[d.post.id,d.post.title,d.post.author,d.post.subreddit,d.post.url,d.post.created_at,d.post.score,d.post.upvote_ratio,d.post.flair,c.id,c.parent_id,c.author,c.score,c.depth,c.is_op,c.is_deleted,c.timestamp,c.content,c.links])].map(r=>r.map(csvCell).join(',')).join('\r\n');
  }
  function mdEscape(v){return String(v??'').replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\n/g,'<br>');}
  function toMarkdown(d){
    const lines=[`# ${d.post.title||'Reddit Thread'}`,``,`- **Author:** ${d.post.author||'Unknown'}`,`- **Subreddit:** ${d.post.subreddit||'Unknown'}`,`- **URL:** ${d.post.url}`,`- **Score:** ${d.post.score??'Unknown'}`,`- **Extracted:** ${d.extracted_at}`,``,`## Post`,``,d.post.body||'_No post body detected._','','## Comments',''];
    for(const c of d.comments){ const indent='  '.repeat(Math.min(c.depth||0,12)); lines.push(`${indent}- **${mdEscape(c.author||'[deleted]')}** · score ${c.score??'?'} · depth ${c.depth??0}`); lines.push(`${indent}  ${mdEscape(c.content||'')}`); }
    return lines.join('\n');
  }
  function download(name,content,type){const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
  function slug(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45)||'reddit-thread';}
  function ensureData(){if(state.data)return state.data;try{return state.data=extract();}catch(e){status(e.message,'error');return null;}}

  function status(message,kind=''){const e=document.querySelector(`#${PANEL_ID} .rxe-status`);if(e){e.textContent=message;e.dataset.kind=kind;}}
  function progress(value,max,message){const b=document.querySelector(`#${PANEL_ID} .rxe-progress-bar`),l=document.querySelector(`#${PANEL_ID} .rxe-progress-label`);if(b)b.style.width=`${Math.max(0,Math.min(100,value/max*100))}%`;if(l)l.textContent=message;}
  function setButtons(disabled){document.querySelectorAll(`#${PANEL_ID} button`).forEach(b=>{if(!['pause','stop'].includes(b.dataset.action))b.disabled=disabled;});}
  function filename(ext){const d=state.data;return `reddit_${slug(d?.post?.subreddit)}_${d?.post?.id||Date.now()}.${ext}`;}

  async function start(){
    if(state.running)return; state.running=true;state.paused=false;state.data=null;state.clicks=0;state.rounds=0;setButtons(true);progress(0,MAX_ROUNDS,'Preparing thread…');status('Working…');
    try{
      if(!postId())throw new Error('Open a specific Reddit post/thread first.');
      window.scrollTo({top:0,behavior:'instant'});await sleep(400);
      const initial=commentEls().length;progress(1,MAX_ROUNDS,`Scanning thread · ${initial} comments initially loaded`);
      await expandAll(); await sleep(500); progress(MAX_ROUNDS-1,MAX_ROUNDS,'Final verification…'); state.data=extract();
      const s=state.data.stats;status(`Complete · ${s.loaded_comments} comments · ${s.replies} replies · depth ${s.max_depth}`,'ok');progress(MAX_ROUNDS,MAX_ROUNDS,`Complete · ${s.loaded_comments} comments/replies found`);
    }catch(e){console.error('[Reddit Extractor]',e);status(e.message||'Extraction failed','error');progress(0,MAX_ROUNDS,'Failed');}
    finally{state.running=false;state.paused=false;setButtons(false);}
  }
  function stop(){if(state.running){state.running=false;state.paused=false;status('Stopped. Loaded content can still be exported.','error');}}
  function pause(){if(!state.running)return;state.paused=!state.paused;const b=document.querySelector(`#${PANEL_ID} [data-action="pause"]`);if(b)b.textContent=state.paused?'Resume':'Pause';status(state.paused?'Paused — Reddit is not being clicked.':'Resumed…');}

  function createPanel(){
    if(document.getElementById(PANEL_ID))return;
    const style=document.createElement('style');style.textContent=`#${PANEL_ID}{position:fixed;right:18px;bottom:18px;width:360px;z-index:2147483647;font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b}#${PANEL_ID}*{box-sizing:border-box}.rxe-card{background:#fff;border:1px solid #e4e4e7;border-radius:16px;box-shadow:0 20px 60px #0003;overflow:hidden}.rxe-head{padding:13px 15px;border-bottom:1px solid #e4e4e7;display:flex;justify-content:space-between;gap:10px}.rxe-title{font-weight:800}.rxe-version{font-size:10px;color:#71717a}.rxe-body{padding:14px}.rxe-help{font-size:11px;color:#71717a;margin-bottom:11px}.rxe-progress{height:9px;background:#e4e4e7;border-radius:999px;overflow:hidden}.rxe-progress-bar{height:100%;width:0;background:#18181b;transition:width .22s}.rxe-progress-label{font-size:10px;color:#71717a;margin:6px 0 11px;min-height:15px}.rxe-actions{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:7px}.rxe-actions button{min-height:34px;border:1px solid #d4d4d8;background:#fff;border-radius:9px;font:600 11px system-ui;color:#18181b;cursor:pointer}.rxe-actions .primary{grid-column:1/-1;background:#18181b;color:#fff;border-color:#18181b}.rxe-actions button:disabled{opacity:.45;cursor:not-allowed}.rxe-status{margin-top:9px;padding:8px 9px;background:#f4f4f5;border-radius:9px;font-size:11px;color:#52525b;word-break:break-word}.rxe-status[data-kind=ok]{background:#f0fdf4;color:#166534}.rxe-status[data-kind=error]{background:#fef2f2;color:#991b1b}.rxe-mini{display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:#71717a}@media(max-width:600px){#${PANEL_ID}{left:10px;right:10px;bottom:10px;width:auto}}`;
    document.head.appendChild(style);
    const p=document.createElement('div');p.id=PANEL_ID;p.innerHTML=`<div class="rxe-card"><div class="rxe-head"><div class="rxe-title">Reddit Thread Extractor</div><div class="rxe-version">v${VERSION}</div></div><div class="rxe-body"><div class="rxe-help">Expands visible reply controls, rescans dynamically loaded content, preserves parent/depth relationships, then exports post metadata + comments.</div><div class="rxe-progress"><div class="rxe-progress-bar"></div></div><div class="rxe-progress-label">Ready</div><div class="rxe-actions"><button class="primary" data-action="start">Expand + Extract</button><button data-action="pause">Pause</button><button data-action="stop">Stop</button><button data-action="json">JSON</button><button data-action="csv">CSV</button><button data-action="md">Markdown</button><button data-action="copy">Copy JSON</button></div><div class="rxe-status">Ready — open a Reddit post.</div><div class="rxe-mini"><span>Rendered-page mode</span><span>v${VERSION}</span></div></div></div>`;
    document.body.appendChild(p);
    p.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.action; if(a==='start')start();else if(a==='pause')pause();else if(a==='stop')stop();else if(a==='json'){const d=ensureData();if(d)download(filename('json'),JSON.stringify(d,null,2),'application/json;charset=utf-8');}else if(a==='csv'){const d=ensureData();if(d)download(filename('csv'),toCSV(d),'text/csv;charset=utf-8');}else if(a==='md'){const d=ensureData();if(d)download(filename('md'),toMarkdown(d),'text/markdown;charset=utf-8');}else if(a==='copy'){const d=ensureData();if(d)try{await navigator.clipboard.writeText(JSON.stringify(d,null,2));status('JSON copied to clipboard','ok');}catch{status('Clipboard permission denied','error');}}});
  }

  function boot(){createPanel();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
