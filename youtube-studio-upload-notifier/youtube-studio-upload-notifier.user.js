// ==UserScript==
// @name         YouTube Studio Upload Batch Notifier
// @namespace    https://studio.youtube.com/
// @version      3.3
// @description  Desktop notification + looping sound jab YouTube Studio me upload batch poora ho (jaise "Uploading 15 of 15"). Sound tab tak bajta hai jab tak aap popup close na karein.
// @author       You
// @match        https://studio.youtube.com/*
// @grant        GM_notification
// @grant        GM_getResourceURL
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const LOG = (...a) => console.log('[YT-Upload-Notify]', ...a);

  /* ==================================================================
     SOUND SETTINGS
     ------------------------------------------------------------------
     url          : online mp3 (yahan myinstants ka link laga hai).
     fallbackUrl  : ek aur backup link, agar pehle wale fail hon.
     (Local file backup ke liye: upar metadata me @resource line add karein
      aur Chrome me "Allow access to file URLs" ON karein.)
     showTestBtn  : page par ek chhota "Test sound" button (debug ke liye).
     ================================================================== */
  const SOUND = {
    url:          'https://www.myinstants.com/media/sounds/anime-wow-sound-effect.mp3',
    resourceName: 'soundLocal',
    fallbackUrl:  '',
    volume:       0.9,
    loop:         true,
    showTestBtn:  true
  };

  const SEL = {
    monitor:   'ytcp-multi-progress-monitor',
    counter:   'span.count',                  // "Uploading 4 of 15"
    row:       'li.row',
    rowStatus: '.progress-status-text',
    rowTitle:  '.progress-title'
  };

  const state = { notified: false, lastTotal: 0 };

  /* ============================== AUDIO ================================= */
  let audio = null;
  let sources = [];
  let srcIndex = 0;
  let audioUnlocked = false;
  let testPlaying = false;

  function buildSources() {
    const list = [];
    if (SOUND.url) list.push(SOUND.url);
    try {
      if (typeof GM_getResourceURL !== 'undefined') {
        const u = GM_getResourceURL(SOUND.resourceName);
        if (u) list.push(u);
      }
    } catch (e) { LOG('local @resource not available:', e); }
    if (SOUND.fallbackUrl) list.push(SOUND.fallbackUrl);
    return list;
  }

  function loadAudio() {
    if (!audio) {
      sources = buildSources();
      if (!sources.length) { LOG('No sound source configured.'); return null; }

      audio = new Audio();
      audio.loop = SOUND.loop;
      audio.volume = SOUND.volume;
      audio.preload = 'auto';
      audio.src = sources[0];

      // If one source fails to load, try the next one.
      audio.addEventListener('error', () => {
        LOG('Sound source failed:', sources[srcIndex]);
        srcIndex++;
        if (srcIndex < sources.length) {
          audio.src = sources[srcIndex];
          LOG('Trying next source:', sources[srcIndex]);
        } else {
          LOG('All sound sources failed to load.');
        }
      });
    }
    return audio;
  }

  // A user gesture is required by Chrome before a page may play audio.
  // We "prime" the audio element on the first click/key press.
  function unlockAudio() {
    // A user gesture has now happened, so Chrome allows audio on this page.
    // We ONLY preload here - we deliberately do NOT play()/pause(), because a
    // pause() during another play() is what threw "AbortError" earlier.
    loadAudio();
    if (!audioUnlocked) { audioUnlocked = true; LOG('Audio unlocked.'); }
  }

  // loop = true -> plays repeatedly (used by the real notification)
  // loop = false -> plays once (used by the Test button)
  function playSound(loop) {
    const a = loadAudio();
    if (!a) return null;
    a.loop = !!loop;
    a.currentTime = 0;
    try {
      const p = a.play();
      if (p && p.catch) {
        p.then(() => { audioUnlocked = true; })
         .catch((err) => {
           LOG('Autoplay blocked - click "Play sound" on the popup.', err);
           markSoundBlocked();
         });
      }
    } catch (e) { LOG('playSound() error:', e); }
    return a;
  }

  function startSound() { playSound(SOUND.loop); }

  function stopSound() {
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch (e) { LOG(e); }
    testPlaying = false;
    const tb = document.getElementById('ytup-test-btn');
    if (tb) tb.textContent = '\uD83D\uDD0A Test sound';
  }

  function markSoundBlocked() {
    const btn = document.getElementById('ytup-sound-btn');
    if (btn) btn.style.display = 'inline-block';
  }

  /* ============================ NOTIFICATION ============================ */
  function ensurePermission() {
    if (typeof GM_notification !== 'undefined') return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function notify(title, text) {
    try {
      if (typeof GM_notification !== 'undefined') {
        GM_notification({
          title, text, timeout: 0,
          onclick: () => window.focus(),
          ondone:  () => { stopSound(); hidePopup(); }
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(title, { body: text, tag: 'yt-upload-batch', requireInteraction: true });
        n.onclick = () => window.focus();
        n.onclose = () => { stopSound(); hidePopup(); };
      }
    } catch (e) { LOG('OS notification failed:', e); }

    // Start the sound FIRST, then draw the popup - so a popup problem can
    // never stop the notification sound from playing.
    startSound();
    try { showPopup(title, text); } catch (e) { LOG('popup render failed:', e); }
  }

  /* ------------------------------- POPUP -------------------------------- */
  let popupEl = null;

  function showPopup(title, text) {
    if (!popupEl) {
      popupEl = document.createElement('div');
      popupEl.id = 'ytup-popup';
      Object.assign(popupEl.style, {
        position: 'fixed', right: '16px', bottom: '16px', zIndex: '999999',
        background: '#0f9d58', color: '#fff', padding: '14px 16px',
        borderRadius: '10px', fontFamily: 'Roboto, Arial, sans-serif',
        fontSize: '14px', lineHeight: '1.45', maxWidth: '340px',
        boxShadow: '0 6px 18px rgba(0,0,0,.35)'
      });

      const msg = document.createElement('div');
      msg.id = 'ytup-popup-msg';
      popupEl.appendChild(msg);

      const row = document.createElement('div');
      row.style.marginTop = '10px';

      const soundBtn = document.createElement('button');
      soundBtn.id = 'ytup-sound-btn';
      soundBtn.textContent = 'Play sound';
      soundBtn.style.cssText = 'display:none;margin-right:8px;padding:6px 12px;border:0;border-radius:6px;background:#fff;color:#0f9d58;font-weight:600;cursor:pointer';
      soundBtn.addEventListener('click', (e) => { e.stopPropagation(); startSound(); soundBtn.style.display = 'none'; });

      const closeBtn = document.createElement('button');
      closeBtn.id = 'ytup-close-btn';
      closeBtn.textContent = 'Close (sound band karein)';
      closeBtn.style.cssText = 'padding:6px 12px;border:0;border-radius:6px;background:#fff;color:#0f9d58;font-weight:600;cursor:pointer';
      closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeEverything(); });

      row.appendChild(soundBtn);
      row.appendChild(closeBtn);
      popupEl.appendChild(row);
      document.body.appendChild(popupEl);
    }

    // NOTE: YouTube Studio enforces Trusted Types, so element.innerHTML is
    // blocked. We build the popup text with plain DOM nodes instead.
    const msgEl = document.getElementById('ytup-popup-msg');
    msgEl.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = title;
    msgEl.appendChild(strong);
    msgEl.appendChild(document.createElement('br'));
    msgEl.appendChild(document.createTextNode(text));
    popupEl.style.display = 'block';
  }

  function hidePopup() { if (popupEl) popupEl.style.display = 'none'; }

  function closeEverything() {
    stopSound();
    hidePopup();
    try { if (typeof GM_notification !== 'undefined') GM_notification({ timeout: 0, text: '', title: '' }); } catch (e) {}
  }

  /* --------------------------- TEST BUTTON ------------------------------ */
  function addTestButton() {
    if (!SOUND.showTestBtn) return;
    const b = document.createElement('button');
    b.id = 'ytup-test-btn';
    b.textContent = '\uD83D\uDD0A Test sound';
    b.title = 'Click to play once, click again to stop';
    b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:999999;padding:6px 10px;border:0;border-radius:6px;background:#202124;color:#fff;font-size:12px;cursor:pointer;opacity:.75';
    b.addEventListener('click', () => {
      audioUnlocked = true;
      const a = loadAudio();
      if (!a) return;
      if (testPlaying) {                 // second click = stop
        a.pause(); a.currentTime = 0;
        testPlaying = false;
        b.textContent = '\uD83D\uDD0A Test sound';
        return;
      }
      a.onended = () => { testPlaying = false; b.textContent = '\uD83D\uDD0A Test sound'; };
      a.loop = false;                    // test = play ONE time only
      a.currentTime = 0;
      a.play()
        .then(() => { testPlaying = true; b.textContent = '\u23F9 Stop test'; })
        .catch((e) => LOG('test play failed:', e));
    });
    document.body.appendChild(b);
  }

  /* ============================= DETECTION ============================== */
  function countRows() {
    const m = document.querySelector(SEL.monitor);
    return m ? m.querySelectorAll(SEL.row).length : 0;
  }

  function countErrors() {
    const m = document.querySelector(SEL.monitor);
    if (!m) return 0;
    let n = 0;
    m.querySelectorAll(SEL.row).forEach((r) => {
      const s = (r.querySelector(SEL.rowStatus)?.textContent || '').toLowerCase();
      if (/error|failed|couldn.?t|unable/.test(s)) n++;
    });
    return n;
  }

  function finish(total) {
    state.notified = true;
    const errs = countErrors();
    const title = 'YouTube uploads complete';
    const text = (total ? total + ' video upload ho gaye.' : 'Upload batch complete.')
               + (errs ? ' (' + errs + ' me error)' : '');
    notify(title, text);
    LOG('NOTIFIED. total =', total, 'errors =', errs);
  }

  function checkUploads() {
    const monitor = document.querySelector(SEL.monitor);
    const counter = monitor ? monitor.querySelector(SEL.counter) : null;

    if (!monitor || !counter) {
      if (state.lastTotal) LOG('Upload panel closed - state reset.');
      state.notified = false;
      state.lastTotal = 0;
      return;
    }

    const txt = (counter.textContent || '').trim();
    const m = txt.match(/Uploading\s+(\d+)\s+of\s+(\d+)/i);

    if (m) {
      const cur = parseInt(m[1], 10);
      const total = parseInt(m[2], 10);

      if (total !== state.lastTotal) { state.notified = false; state.lastTotal = total; LOG('New batch. total =', total); }
      if (cur < total) state.notified = false;
      if (cur >= total && !state.notified) finish(total);
      return;
    }

    if (/uploads?\s+complete|finished/i.test(txt) && !state.notified) {
      finish(state.lastTotal || countRows());
      return;
    }

    const rows = monitor.querySelectorAll(SEL.row);
    if (rows.length) {
      const allDone = Array.from(rows).every(
        (r) => /100%\s*uploaded/i.test(r.querySelector(SEL.rowStatus)?.textContent || '')
      );
      if (allDone && !state.notified) finish(rows.length);
    }
  }

  /* =============================== WIRING =============================== */
  let debounce = null;
  const schedule = () => { clearTimeout(debounce); debounce = setTimeout(checkUploads, 800); };

  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });

  setInterval(checkUploads, 5000);

  // Unlock audio on the first real user gesture (Chrome autoplay rule).
  ['click', 'pointerdown', 'keydown'].forEach((ev) =>
    document.addEventListener(ev, () => { if (!audioUnlocked) unlockAudio(); }, { once: true })
  );

  ensurePermission();
  addTestButton();
  loadAudio();     // start preloading the mp3
  checkUploads();
  LOG('script loaded (v3.0).');
})();
