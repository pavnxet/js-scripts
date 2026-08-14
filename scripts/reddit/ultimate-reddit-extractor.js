// ==UserScript==
// @name         Reddit Thread Extractor — Universal
// @namespace    js-scripts
// @version      4.1.0
// @description  Compatibility-first Reddit thread extractor with automatic reply expansion, progress, metadata, exports and a glassmorphism/minimizable UI.
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @match        https://new.reddit.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '4.1.0';
  const PANEL_ID = 'js-scripts-reddit-extractor';
  const MAX_ROUNDS = 120;
  const BATCH_SIZE = 8;
  const state = { running:false, paused:false, minimized:false, data:null, clicks:0, rounds:0 };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = v => v == null ? '' : String(v).replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
  const num = v => { if(v == null || v === '') return null; const n=Number(String(v).replace(/,/g,'')); return Number.isFinite(n)?n:null; };
  const txt = el => clean(el?.innerText || el?.textContent || '');
  const attr = (el,names) => { for(const n of names){ const v=el?.getAttribute?.(n); if(v) return v; } return ''; };
  const uniq = a => [...new Set((a||[]).filter(Boolean))];

  function deepAll(root=document) {
    const out=[];
    const walk=r=>{
      if(!r?.querySelectorAll) return;
      for(const el of r.querySelectorAll('*')) {
        out.push(el);
        if(el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(root);
    return out;
  }
  function deepQuery(selectors) {
    const out=[], selector=selectors.join(',');
    const walk=r=>{
      if(!r?.querySelectorAll) return;
      out.push(...r.querySelectorAll(selector));
      for(const el of r.querySelectorAll('*')) if(el.shadowRoot) walk(el.shadowRoot);
    };
    walk(document);
    return [...new Set(out)];
  }
  function first(root, selectors) {
    for(const s of selectors){ const n=root?.querySelector?.(s); const v=txt(n); if(v) return v; }
    return '';
  }
  function links(root, includeReddit=false) {
    return uniq([...(root?.querySelectorAll?.('a[href]')||[])].map(a=>{
      try {
        const u=new URL(a.href,location.href);
        if(!/^https?:$/i.test(u.protocol)) return '';
        if(!includeReddit && (u.hostname==='reddit.com'||u.hostname.endsWith('.reddit.com'))) return '';
        return u.href;
      } catch { return ''; }
    }));
  }

  const COMMENT_SELECTORS = [
    'shreddit-comment[thingid]','shreddit-comment[id]',
    '[data-testid="comment"]','div[data-testid="comment"]','.thing.comment'
  ];

  function postEl(){
    return document.querySelector(
      'shreddit-post[thingid],shreddit-post[post-id],article[data-testid="post-container"],' +
      'div[data-testid="post-container"],article[aria-label],.thing.link'
    );
  }
  function postId(){
    const m=location.pathname.match(/\/comments\/([a-z0-9]+)/i);
    if(m) return m[1];
    const el=postEl();
    return attr(el,['thingid','post-id']) ||
      attr(el,['id']).replace(/^t3_/i,'') || el?.dataset?.postId || null;
  }
  function canonical(){
    return document.querySelector('link[rel="canonical"]')?.href || location.href.split('#')[0];
  }
  function content(root){
    return first(root,[
      '[slot="text-body"]','[slot="comment"]','[data-testid="post-content"]',
      '[data-testid="comment-content"]','[id$="-rtjson-content"]',
      '[id$="-content"]','.RichTextJSON-root','.md'
    ]);
  }

  function getPost(){
    const el=postEl(), id=postId();
    const title=clean(attr(el,['title']) ||
      first(el,['h1[slot="title"]','h1','a.title']) ||
      first(document,['h1[slot="title"]','h1','a.title']) ||
      document.title.replace(/\s*:\s*Reddit.*$/i,''));
    const author=clean(attr(el,['author','author-name']) ||
      first(el,['[data-testid="post_author_link"]','a[href*="/user/"]','.author']));
    const subreddit=clean(attr(el,['subreddit-prefixed-name','subreddit']) ||
      first(el,['a[href*="/r/"]','.subreddit']) || first(document,['a[href*="/r/"]','.subreddit']));
    return {
      id:id||null,title:title||null,author:author||null,subreddit:subreddit||null,
      url:canonical(),permalink:canonical(),body:content(el)||null,
      score:num(attr(el,['score'])||el?.querySelector?.('[score]')?.getAttribute('score')),
      upvote_ratio:num(attr(el,['upvote-ratio','upvote_ratio'])),
      comment_count_reported:num(attr(el,['comment-count','commentcount'])),
      created_at:attr(el,['created-timestamp','created'])||el?.querySelector?.('time')?.getAttribute('datetime')||null,
      flair:clean(attr(el,['flair-text'])||first(el,['[slot="post-flair"]','[data-testid="post-flair"]','.linkflairlabel']))||null,
      is_nsfw:attr(el,['is-nsfw'])==='true'||!!el?.querySelector?.('[data-testid="post-nsfw"],span[title*="NSFW"]'),
      is_spoiler:attr(el,['is-spoiler'])==='true'||!!el?.querySelector?.('[data-testid="post-spoiler"],span[title*="Spoiler"]'),
      links:links(el,true)
    };
  }

  function idOf(el){
    return clean(attr(el,['thingid','comment-id'])||el.dataset?.commentId||
      el.dataset?.fullName||attr(el,['id'])).replace(/^t1_/i,'')||null;
  }
  function commentEls(){ return deepQuery(COMMENT_SELECTORS).filter(idOf); }
  function parentId(el){
    const direct=attr(el,['parentid','parent-id'])||el.dataset?.parentId;
    if(direct) return clean(direct).replace(/^t[13]_/, '');
    let p=el.parentElement;
    while(p){ if(p.matches?.(COMMENT_SELECTORS.join(','))) return idOf(p); p=p.parentElement; }
    return null;
  }
  function depthOf(el){
    const d=num(attr(el,['depth'])); if(d!=null) return d;
    let p=el.parentElement,n=0;
    while(p){ if(p.matches?.(COMMENT_SELECTORS.join(','))) n++; p=p.parentElement; }
    return n;
  }
  function commentData(el,post){
    const author=clean(attr(el,['author','author-name'])||first(el,['[slot="author"]','a[href*="/user/"]','.author']));
    const deleted=/^\[deleted\]$/i.test(author)||el.hasAttribute('deleted');
    return {
      id:idOf(el),parent_id:parentId(el),author:author||null,
      score:num(attr(el,['score'])||el.querySelector?.('[score]')?.getAttribute('score')),
      depth:depthOf(el),is_op:!!author&&!!post.author&&author===post.author,
      is_deleted:deleted,content:content(el)||(deleted?'[deleted]':''),
      timestamp:el.querySelector?.('time')?.getAttribute('datetime')||attr(el,['created-timestamp','created'])||null,
      links:links(el)
    };
  }

  function extract(){
    const post=getPost();
    if(!post.id) throw new Error('Open a specific Reddit post/thread first.');
    const comments=[],seen=new Set();
    for(const el of commentEls()){
      const c=commentData(el,post);
      if(c.id&&!seen.has(c.id)){ seen.add(c.id); comments.push(c); }
    }
    comments.sort((a,b)=>(a.depth??999)-(b.depth??999));
    const expected=post.comment_count_reported;
    return {
      schema_version:'4.1',tool_version:VERSION,source:'Rendered Reddit page',
      extracted_at:new Date().toISOString(),post,comments,
      stats:{
        loaded_comments:comments.length,
        top_level_comments:comments.filter(c=>!c.parent_id).length,
        replies:comments.filter(c=>!!c.parent_id).length,
        max_depth:comments.reduce((m,c)=>Math.max(m,c.depth??0),0),
        reported_comment_count:expected,
        completeness_estimate:expected>0?`${Math.min(100,Math.round(comments.length/expected*100))}%`:null,
        expansion_clicks:state.clicks,expansion_rounds:state.rounds
      }
    };
  }

  function labelOf(el){ return clean(el.getAttribute?.('aria-label')||el.getAttribute?.('title')||txt(el)); }
  function expandable(){
    const re=/(more\s+(repl(?:y|ies)|comments?)|view\s+(more|all)|load\s+(more|all)|show\s+(more|all)|continue\s+(this\s+)?thread|\d+\s+(more\s+)?repl(?:y|ies)|repl(?:y|ies)\s*\(\d+\))/i;
    return deepAll().filter(el=>{
      if(!(el instanceof HTMLElement)||el.closest(`#${PANEL_ID}`)||el.offsetParent===null) return false;
      const tag=el.tagName.toLowerCase(),role=el.getAttribute('role');
      if(!['button','a','summary'].includes(tag)&&role!=='button') return false;
      const label=labelOf(el);
      return label&&re.test(label)&&!/share|report|award|reply$/i.test(label);
    });
  }
  async function waitForChange(before,timeout=2200){
    const end=Date.now()+timeout;
    while(Date.now()<end){ if(commentEls().length>before)return true; await sleep(120); }
    return false;
  }
  async function expandAll(){
    let stable=0,previous=commentEls().length;
    for(let round=1;round<=MAX_ROUNDS&&state.running;round++){
      state.rounds=round;
      while(state.paused&&state.running) await sleep(200);
      const controls=[...new Set(expandable())];
      progress(round,MAX_ROUNDS,`Expanding replies · ${state.clicks} actions · ${previous} loaded`);
      if(!controls.length){
        window.scrollTo({top:Math.min(document.body.scrollHeight,window.scrollY+Math.max(600,innerHeight*.9)),behavior:'smooth'});
        await sleep(650);
      }else{
        let changed=false;
        for(const c of controls.slice(0,BATCH_SIZE)){
          if(!state.running)break;
          while(state.paused&&state.running)await sleep(200);
          try{
            c.scrollIntoView({block:'center'}); await sleep(80); c.click(); state.clicks++;
            changed=await waitForChange(previous)||changed;
          }catch{}
        }
        await sleep(450);
        if(changed)stable=0;else stable++;
      }
      const now=commentEls().length;
      if(now===previous&&expandable().length===0)stable++;
      else if(now>previous)stable=0;
      previous=now;
      if(stable>=4)break;
    }
    return {loaded:commentEls().length,clicks:state.clicks,rounds:state.rounds};
  }

  function csvCell(v){ return `"${String(Array.isArray(v)?v.join(' | '):v??'').replace(/"/g,'""')}"`; }
  function toCSV(d){
    const h=['post_id','post_title','post_author','subreddit','post_url','post_created_at','post_score',
      'post_upvote_ratio','post_flair','comment_id','parent_id','author','score','depth','is_op',
      'is_deleted','timestamp','content','links'];
    return [h,...d.comments.map(c=>[
      d.post.id,d.post.title,d.post.author,d.post.subreddit,d.post.url,d.post.created_at,
      d.post.score,d.post.upvote_ratio,d.post.flair,c.id,c.parent_id,c.author,c.score,c.depth,
      c.is_op,c.is_deleted,c.timestamp,c.content,c.links
    ])].map(r=>r.map(csvCell).join(',')).join('\r\n');
  }
  function mdEscape(v){return String(v??'').replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\n/g,'<br>');}
  function toMarkdown(d){
    const lines=[`# ${d.post.title||'Reddit Thread'}`,'',
      `- **Author:** ${d.post.author||'Unknown'}`,`- **Subreddit:** ${d.post.subreddit||'Unknown'}`,
      `- **URL:** ${d.post.url}`,`- **Score:** ${d.post.score??'Unknown'}`,
      `- **Extracted:** ${d.extracted_at}`,'','## Post','',d.post.body||'_No post body detected._',
      '','## Comments',''];
    for(const c of d.comments){
      const indent='  '.repeat(Math.min(c.depth||0,12));
      lines.push(`${indent}- **${mdEscape(c.author||'[deleted]')}** · score ${c.score??'?'} · depth ${c.depth??0}`);
      lines.push(`${indent}  ${mdEscape(c.content||'')}`);
    }
    return lines.join('\n');
  }
  function download(name,content,type){
    const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),2000);
  }
  function slug(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45)||'reddit-thread';}
  function ensureData(){
    if(state.data)return state.data;
    try{return state.data=extract();}catch(e){status(e.message,'error');return null;}
  }

  function status(message,kind=''){
    const e=document.querySelector(`#${PANEL_ID} .rxe-status`);
    if(e){e.textContent=message;e.dataset.kind=kind;}
  }
  function progress(value,max,message){
    const b=document.querySelector(`#${PANEL_ID} .rxe-progress-bar`);
    const l=document.querySelector(`#${PANEL_ID} .rxe-progress-label`);
    if(b)b.style.width=`${Math.max(0,Math.min(100,value/max*100))}%`;
    if(l)l.textContent=message;
  }
  function setButtons(disabled){
    document.querySelectorAll(`#${PANEL_ID} button`).forEach(b=>{
      if(!['pause','stop','minimize'].includes(b.dataset.action))b.disabled=disabled;
    });
  }
  function filename(ext){
    const d=state.data;
    return `reddit_${slug(d?.post?.subreddit)}_${d?.post?.id||Date.now()}.${ext}`;
  }

  async function start(){
    if(state.running)return;
    state.running=true;state.paused=false;state.data=null;state.clicks=0;state.rounds=0;
    setButtons(true);progress(0,MAX_ROUNDS,'Preparing thread…');status('Working…');
    try{
      if(!postId())throw new Error('Open a specific Reddit post/thread first.');
      window.scrollTo({top:0,behavior:'instant'});await sleep(400);
      const initial=commentEls().length;
      progress(1,MAX_ROUNDS,`Scanning thread · ${initial} comments initially loaded`);
      await expandAll(); await sleep(500);
      progress(MAX_ROUNDS-1,MAX_ROUNDS,'Final verification…'); state.data=extract();
      const s=state.data.stats;
      status(`Complete · ${s.loaded_comments} comments · ${s.replies} replies · depth ${s.max_depth}`,'ok');
      progress(MAX_ROUNDS,MAX_ROUNDS,`Complete · ${s.loaded_comments} comments/replies found`);
    }catch(e){
      console.error('[Reddit Extractor]',e);status(e.message||'Extraction failed','error');progress(0,MAX_ROUNDS,'Failed');
    }finally{
      state.running=false;state.paused=false;setButtons(false);
    }
  }
  function stop(){
    if(state.running){state.running=false;state.paused=false;status('Stopped. Loaded content can still be exported.','error');}
  }
  function pause(){
    if(!state.running)return;
    state.paused=!state.paused;
    const b=document.querySelector(`#${PANEL_ID} [data-action="pause"]`);
    if(b)b.textContent=state.paused?'Resume':'Pause';
    status(state.paused?'Paused — Reddit is not being clicked.':'Resumed…');
  }
  function toggleMinimize(){
    const p=document.getElementById(PANEL_ID); if(!p)return;
    state.minimized=!state.minimized;p.classList.toggle('rxe-minimized',state.minimized);
    const b=p.querySelector('[data-action="minimize"]');
    if(b){b.textContent=state.minimized?'□':'—';b.title=state.minimized?'Restore extractor':'Minimize extractor';b.setAttribute('aria-label',b.title);}
    try{localStorage.setItem(PANEL_ID+'-minimized',state.minimized?'1':'0');}catch{}
  }

  function createPanel(){
    if(document.getElementById(PANEL_ID))return;
    const style=document.createElement('style');style.textContent=`
      #${PANEL_ID}{position:fixed;right:18px;bottom:18px;width:380px;z-index:2147483647;font:13px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f4f4f5;letter-spacing:.01em}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .rxe-card{overflow:hidden;border:1px solid rgba(255,255,255,.22);border-radius:20px;background:linear-gradient(135deg,rgba(255,255,255,.16),rgba(255,255,255,.06));backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);box-shadow:0 24px 70px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.22)}
      #${PANEL_ID} .rxe-head{min-height:54px;padding:12px 12px 12px 15px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);user-select:none}
      #${PANEL_ID} .rxe-brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
      #${PANEL_ID} .rxe-dot{width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 18px rgba(255,255,255,.75);flex:none}
      #${PANEL_ID} .rxe-title{font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${PANEL_ID} .rxe-version{font-size:10px;color:rgba(255,255,255,.55);margin-top:1px}
      #${PANEL_ID} .rxe-head-actions{display:flex;gap:6px}
      #${PANEL_ID} .rxe-icon{width:29px;height:29px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer;font-size:15px;display:grid;place-items:center;transition:background .18s,transform .18s}
      #${PANEL_ID} .rxe-icon:hover{background:rgba(255,255,255,.17);transform:translateY(-1px)}
      #${PANEL_ID} .rxe-body{padding:15px}
      #${PANEL_ID} .rxe-help{font-size:11px;color:rgba(255,255,255,.66);margin-bottom:12px}
      #${PANEL_ID} .rxe-progress{height:8px;background:rgba(255,255,255,.13);border-radius:999px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.15)}
      #${PANEL_ID} .rxe-progress-bar{height:100%;width:0;background:linear-gradient(90deg,#fff,rgba(255,255,255,.55));border-radius:999px;transition:width .22s ease;box-shadow:0 0 14px rgba(255,255,255,.4)}
      #${PANEL_ID} .rxe-progress-label{font-size:10px;color:rgba(255,255,255,.58);margin:7px 0 12px;min-height:15px}
      #${PANEL_ID} .rxe-actions{display:grid;grid-template-columns:1.45fr 1fr 1fr;gap:7px}
      #${PANEL_ID} .rxe-actions button{min-height:34px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;font:600 11px inherit;cursor:pointer;transition:transform .18s,background .18s,border-color .18s}
      #${PANEL_ID} .rxe-actions button:hover:not(:disabled){transform:translateY(-1px);background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3)}
      #${PANEL_ID} .rxe-actions .primary{grid-column:1/-1;background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.3)}
      #${PANEL_ID} .rxe-actions button:disabled{opacity:.42;cursor:not-allowed}
      #${PANEL_ID} .rxe-status{margin-top:10px;padding:9px 10px;background:rgba(0,0,0,.13);border:1px solid rgba(255,255,255,.08);border-radius:10px;font-size:11px;color:rgba(255,255,255,.75);word-break:break-word}
      #${PANEL_ID} .rxe-status[data-kind="ok"]{background:rgba(34,197,94,.14);color:#bbf7d0}
      #${PANEL_ID} .rxe-status[data-kind="error"]{background:rgba(239,68,68,.14);color:#fecaca}
      #${PANEL_ID} .rxe-mini{display:flex;justify-content:space-between;margin-top:9px;font-size:10px;color:rgba(255,255,255,.42)}
      #${PANEL_ID}.rxe-minimized{width:210px}
      #${PANEL_ID}.rxe-minimized .rxe-body{display:none}
      #${PANEL_ID}.rxe-minimized .rxe-card{border-radius:16px}
      @media(max-width:600px){#${PANEL_ID}{left:10px;right:10px;bottom:10px;width:auto}#${PANEL_ID}.rxe-minimized{left:auto;width:210px}}
      @media(prefers-reduced-motion:reduce){#${PANEL_ID} *{transition:none!important}}
    `;document.head.appendChild(style);

    const p=document.createElement('div');p.id=PANEL_ID;p.innerHTML=`
      <div class="rxe-card"><div class="rxe-head"><div class="rxe-brand"><span class="rxe-dot"></span><div><div class="rxe-title">Reddit Thread Extractor</div><div class="rxe-version">v${VERSION} · glass UI</div></div></div><div class="rxe-head-actions"><button class="rxe-icon" data-action="minimize" title="Minimize extractor" aria-label="Minimize extractor">—</button></div></div>
      <div class="rxe-body"><div class="rxe-help">Expands visible reply controls, rescans dynamically loaded content, preserves parent/depth relationships, then exports post metadata + comments.</div><div class="rxe-progress"><div class="rxe-progress-bar"></div></div><div class="rxe-progress-label">Ready</div><div class="rxe-actions"><button class="primary" data-action="start">Expand + Extract</button><button data-action="pause">Pause</button><button data-action="stop">Stop</button><button data-action="json">JSON</button><button data-action="csv">CSV</button><button data-action="md">Markdown</button><button data-action="copy">Copy JSON</button></div><div class="rxe-status">Ready — open a Reddit post.</div><div class="rxe-mini"><span>Rendered-page mode</span><span>v${VERSION}</span></div></div></div>`;
    document.body.appendChild(p);

    try{state.minimized=localStorage.getItem(PANEL_ID+'-minimized')==='1';}catch{}
    p.classList.toggle('rxe-minimized',state.minimized);
    const mb=p.querySelector('[data-action="minimize"]');
    if(state.minimized){mb.textContent='□';mb.title='Restore extractor';mb.setAttribute('aria-label','Restore extractor');}

    p.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;const a=b.dataset.action;
      if(a==='minimize')toggleMinimize();else if(a==='start')start();else if(a==='pause')pause();else if(a==='stop')stop();
      else if(a==='json'){const d=ensureData();if(d)download(filename('json'),JSON.stringify(d,null,2),'application/json;charset=utf-8');}
      else if(a==='csv'){const d=ensureData();if(d)download(filename('csv'),toCSV(d),'text/csv;charset=utf-8');}
      else if(a==='md'){const d=ensureData();if(d)download(filename('md'),toMarkdown(d),'text/markdown;charset=utf-8');}
      else if(a==='copy'){const d=ensureData();if(d)try{await navigator.clipboard.writeText(JSON.stringify(d,null,2));status('JSON copied to clipboard','ok');}catch{status('Clipboard permission denied','error');}}
    });
  }

  function boot(){createPanel();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
