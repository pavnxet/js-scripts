// ==UserScript==
// @name         ImgBB Auto Copy & Refresh
// @namespace    https://github.com/pavnxet/js-scripts
// @version      2.0.0
// @description  Copies the link(s) of uploaded images on ImgBB, shows a toast, then refreshes the upload page for the next upload. Copy format, delay and auto-refresh are configurable.
// @author       pavnxet
// @match        https://imgbb.com/*
// @match        https://*.imgbb.com/*
// @icon         https://imgbb.com/favicon.ico
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// @run-at       document-idle
// @noframes
// @downloadURL  https://raw.githubusercontent.com/pavnxet/js-scripts/main/imgbb-auto-copy-refresh/imgbb-auto-copy-refresh.user.js
// @updateURL    https://raw.githubusercontent.com/pavnxet/js-scripts/main/imgbb-auto-copy-refresh/imgbb-auto-copy-refresh.user.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG = '[ImgBB Auto Copy]';

    /* ------------------------------------------------------------------ *
     * 0. Context guard — fail loudly instead of doing nothing silently.
     * ------------------------------------------------------------------ */
    if (!/(^|\.)imgbb\.com$/i.test(location.hostname)) {
        console.error(LOG, 'Wrong context: this userscript only runs on imgbb.com (current host: ' + location.hostname + ').');
        return;
    }

    /* ------------------------------------------------------------------ *
     * 1. Settings (persisted through GM_setValue, localStorage fallback).
     * ------------------------------------------------------------------ */
    const DEFAULTS = Object.freeze({
        enabled: true,
        autoRefresh: true,
        delayMs: 1500,
        format: 'direct',
        toast: true,
        desktopNotify: true,
        debug: false
    });

    const DELAY_STEPS = [1000, 1500, 2500, 4000, 6000, 10000];
    const MIN_DELAY = 500;
    const MAX_DELAY = 15000;

    const FORMATS = {
        url: { label: 'Viewer URL', build: (link) => link.viewer },
        direct: { label: 'Direct link', build: (link) => link.direct || link.viewer },
        bbcode: { label: 'BBCode', build: (link) => '[img]' + (link.direct || link.viewer) + '[/img]' },
        html: {
            label: 'HTML',
            build: (link) => '<img src="' + escapeAttr(link.direct || link.viewer) + '" alt="' + escapeAttr(link.name || 'image') + '">'
        },
        markdown: {
            label: 'Markdown',
            build: (link) => '![' + escapeMarkdown(link.name || 'image') + '](' + (link.direct || link.viewer) + ')'
        }
    };

    const store = {
        get(key, fallback) {
            try {
                if (typeof GM_getValue === 'function') {
                    const value = GM_getValue('ibb_acr_' + key, undefined);
                    if (value !== undefined && value !== null) return value;
                }
                const raw = localStorage.getItem('ibb_acr.' + key);
                if (raw !== null) return JSON.parse(raw);
            } catch (error) {
                console.warn(LOG, 'Could not read setting "' + key + '", using the default.', error);
            }
            return fallback;
        },
        set(key, value) {
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue('ibb_acr_' + key, value);
                    return;
                }
                localStorage.setItem('ibb_acr.' + key, JSON.stringify(value));
            } catch (error) {
                console.error(LOG, 'Could not persist setting "' + key + '".', error);
            }
        }
    };

    const config = loadConfig();

    function loadConfig() {
        const next = {};
        for (const key of Object.keys(DEFAULTS)) {
            next[key] = store.get(key, DEFAULTS[key]);
        }

        next.enabled = Boolean(next.enabled);
        next.autoRefresh = Boolean(next.autoRefresh);
        next.toast = Boolean(next.toast);
        next.desktopNotify = Boolean(next.desktopNotify);
        next.debug = Boolean(next.debug);

        const delay = Number(next.delayMs);
        next.delayMs = Number.isFinite(delay) ? Math.min(MAX_DELAY, Math.max(MIN_DELAY, Math.round(delay))) : DEFAULTS.delayMs;

        const format = String(next.format || '').toLowerCase();
        next.format = Object.prototype.hasOwnProperty.call(FORMATS, format) ? format : DEFAULTS.format;

        return next;
    }

    function setConfig(key, value) {
        config[key] = value;
        store.set(key, value);
        if (config.debug) console.debug(LOG, 'Setting changed:', key, '=', value);
        refreshMenu();
    }

    /* ------------------------------------------------------------------ *
     * 2. Small helpers.
     * ------------------------------------------------------------------ */
    function escapeAttr(value) {
        return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeMarkdown(value) {
        return String(value).replace(/([\[\]\\])/g, '\\$1');
    }

    function isVisible(element) {
        return !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    }

    function humanDelay(ms) {
        return (ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1) + 's';
    }

    function decodeFileName(value) {
        try {
            return decodeURIComponent(value);
        } catch (error) {
            return value;
        }
    }

    /* ------------------------------------------------------------------ *
     * 3. Clipboard — GM_setClipboard, then async Clipboard API, then execCommand.
     * ------------------------------------------------------------------ */
    function copyText(text) {
        return new Promise((resolve) => {
            if (typeof GM_setClipboard === 'function') {
                try {
                    GM_setClipboard(text, 'text');
                    resolve(true);
                    return;
                } catch (error) {
                    console.warn(LOG, 'GM_setClipboard failed, falling back to the Clipboard API.', error);
                }
            }

            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(text).then(
                    () => resolve(true),
                    (error) => {
                        console.warn(LOG, 'navigator.clipboard was blocked, falling back to execCommand.', error);
                        resolve(legacyCopy(text));
                    }
                );
                return;
            }

            resolve(legacyCopy(text));
        });
    }

    function legacyCopy(text) {
        try {
            const area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', 'readonly');
            area.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand('copy');
            area.remove();
            return ok;
        } catch (error) {
            console.error(LOG, 'Clipboard write failed entirely — copy the links from the console instead.', error);
            return false;
        }
    }

    /* ------------------------------------------------------------------ *
     * 4. Reading ImgBB's upload result.
     * ------------------------------------------------------------------ */
    const SUCCESS_SELECTORS = [
        '[data-group="upload-result"][data-result="success"]',
        '#upload-result[data-result="success"]',
        '.queue-item.completed'
    ];

    const COMPLETED_SELECTOR = '.queue-item.completed, .queue-item[data-result="success"]';

    const FALLBACK_ANCHOR_SELECTORS = [
        '[data-group="upload-result"] a.image-link[href]',
        '#upload-result a.image-link[href]',
        '#anywhere-upload a.image-link[href]',
        'a.image-link[href*="ibb.co/"]'
    ];

    const IN_FLIGHT_SELECTORS = [
        '.queue-item.uploading',
        '.queue-item.pending',
        '.queue-item[data-result="uploading"]',
        '.queue-item[data-result="pending"]'
    ];

    function uploadSucceeded() {
        return SUCCESS_SELECTORS.some((selector) => {
            const element = document.querySelector(selector);
            return isVisible(element);
        });
    }

    function uploadInFlight() {
        return IN_FLIGHT_SELECTORS.some((selector) => !!document.querySelector(selector));
    }

    /**
     * Builds the direct (i.ibb.co) URL for a viewer link when the page exposes it.
     * Returns null instead of guessing — callers fall back to the viewer URL.
     */
    function resolveDirect(item, viewerUrl) {
        const directMatch = /^https?:\/\/i\.ibb\.co\/[^/]+\/[^?#]+/i.exec(viewerUrl);
        if (directMatch) return directMatch[0];

        const idMatch = /\/ibb\.co\/([A-Za-z0-9]+)/i.exec(viewerUrl);
        if (!idMatch) return null;
        const id = idMatch[1];

        // 1) ImgBB's own embed fields, when the result panel renders them.
        if (item) {
            for (const field of item.querySelectorAll('input, textarea')) {
                const value = (field.value || '').trim();
                if (new RegExp('^https?://i\\.ibb\\.co/' + id + '/', 'i').test(value)) return value;
            }

            // 2) The thumbnail <img> belonging to the same queue item.
            for (const img of item.querySelectorAll('img[src]')) {
                const match = new RegExp('^(https?://i\\.ibb\\.co/' + id + '/[^?#]+)', 'i').exec(img.src || '');
                if (!match) continue;
                if (/(^|\/)thumb\.[^/]+$/i.test(match[1])) continue; // thumbnail, not the real file
                return match[1];
            }
        }

        return null;
    }

    function fileNameOf(link) {
        if (link.direct) {
            const match = /^https?:\/\/i\.ibb\.co\/[^/]+\/([^/?#]+)/i.exec(link.direct);
            if (match) return decodeFileName(match[1]);
        }
        if (link.name) return link.name;
        return '';
    }

    function collectLinks() {
        const anchors = [];

        document.querySelectorAll(COMPLETED_SELECTOR).forEach((item) => {
            const anchor = item.querySelector('a.image-link[href], a[href*="ibb.co/"]');
            if (anchor) anchors.push({ anchor, item });
        });

        if (!anchors.length) {
            for (const selector of FALLBACK_ANCHOR_SELECTORS) {
                document.querySelectorAll(selector).forEach((anchor) => {
                    anchors.push({ anchor, item: anchor.closest('.queue-item') || anchor.parentElement });
                });
                if (anchors.length) break;
            }
        }

        const links = [];
        const seen = new Set();

        for (const { anchor, item } of anchors) {
            const href = (anchor.href || '').trim();
            if (!/^https?:\/\/[^/]*ibb\.co\//i.test(href)) continue;
            if (!isVisible(anchor)) continue;
            if (seen.has(href)) continue;
            seen.add(href);

            const direct = resolveDirect(item, href);
            if (!direct && config.debug) {
                console.warn(LOG, 'No direct link found for ' + href + ' — falling back to the viewer URL.');
            }

            links.push({
                viewer: href,
                direct: direct,
                name: fileNameOf({ direct: direct, name: '' })
            });
        }

        return links;
    }

    /* ------------------------------------------------------------------ *
     * 5. Toast UI (no innerHTML, no dependencies).
     * ------------------------------------------------------------------ */
    const KINDS = {
        success: { icon: '✓', color: '#3ddc84' },
        info: { icon: 'ℹ', color: '#5aa9ff' },
        error: { icon: '⚠', color: '#ff5c5c' }
    };

    function ensureToastHost() {
        let host = document.getElementById('ibb-acr-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'ibb-acr-host';
            host.style.cssText = [
                'position:fixed', 'left:16px', 'bottom:16px', 'z-index:2147483647',
                'display:flex', 'flex-direction:column', 'gap:8px',
                'pointer-events:none', 'max-width:min(420px,92vw)',
                'font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif'
            ].join(';');
            (document.body || document.documentElement).appendChild(host);
        }
        return host;
    }

    function showToast(options) {
        if (!config.toast) return null;

        const kind = KINDS[options.kind] ? options.kind : 'success';
        const meta = KINDS[kind];
        const host = ensureToastHost();

        const card = document.createElement('div');
        card.setAttribute('role', 'status');
        card.style.cssText = [
            'pointer-events:auto', 'min-width:250px', 'padding:12px 14px',
            'border-radius:12px', 'background:rgba(20,22,28,.95)', 'color:#f2f4f8',
            'box-shadow:0 12px 32px rgba(0,0,0,.4)', 'border:1px solid rgba(255,255,255,.12)',
            'border-left:3px solid ' + meta.color,
            'display:flex', 'flex-direction:column', 'gap:4px',
            'opacity:0', 'transform:translateY(6px)',
            'transition:opacity .18s ease,transform .18s ease'
        ].join(';');

        const titleEl = document.createElement('div');
        titleEl.textContent = meta.icon + ' ' + (options.title || '');
        titleEl.style.cssText = 'font-weight:600;font-size:13.5px;';

        const subEl = document.createElement('div');
        subEl.textContent = options.subtitle || '';
        subEl.style.cssText = 'font-size:12.5px;color:rgba(242,244,248,.72);white-space:pre-line;';

        card.appendChild(titleEl);
        card.appendChild(subEl);

        const toast = {
            card,
            titleEl,
            subEl,
            timer: null,
            dismiss() {
                if (toast.timer) clearTimeout(toast.timer);
                toast.card.style.opacity = '0';
                toast.card.style.transform = 'translateY(6px)';
                setTimeout(() => toast.card.remove(), 220);
            },
            reset(ttl) {
                if (toast.timer) clearTimeout(toast.timer);
                if (ttl > 0) toast.timer = setTimeout(() => toast.dismiss(), ttl);
            }
        };

        if (options.action && options.action.label) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = options.action.label;
            button.style.cssText = 'margin-top:6px;align-self:flex-start;cursor:pointer;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:inherit;border-radius:8px;padding:4px 10px;font:inherit;font-size:12px;';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                options.action.onClick(toast);
            });
            card.appendChild(button);
        }

        host.appendChild(card);
        requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
        toast.reset(typeof options.ttl === 'number' ? options.ttl : 4500);

        return toast;
    }

    /* ------------------------------------------------------------------ *
     * 6. The main flow: copy once, toast, optional reload.
     * ------------------------------------------------------------------ */
    const state = {
        signature: '',
        links: [],
        reloadTimeout: null,
        countdownInterval: null,
        scanTimer: null
    };

    function cancelReload() {
        if (state.reloadTimeout) clearTimeout(state.reloadTimeout);
        if (state.countdownInterval) clearInterval(state.countdownInterval);
        state.reloadTimeout = null;
        state.countdownInterval = null;
    }

    function handleBatch(links) {
        state.links = links;

        const text = links.map((link) => FORMATS[config.format].build(link)).join('\n');
        const summary = links.length + ' link' + (links.length === 1 ? '' : 's') + ' copied · ' + FORMATS[config.format].label;

        copyText(text).then((ok) => {
            if (config.debug) {
                console.log(LOG, 'Copied ' + links.length + ' link(s):\n' + text);
            }
            if (!ok) {
                console.log(LOG, 'Clipboard was blocked. Links:\n' + text);
                showToast({
                    kind: 'error',
                    title: 'Clipboard blocked',
                    subtitle: 'The links were printed to the browser console instead.',
                    ttl: 8000
                });
                return;
            }

            desktopNotify('ImgBB links copied', summary);
            scheduleReload(summary);
        });
    }

    function scheduleReload(summary) {
        if (!config.autoRefresh) {
            showToast({
                kind: 'success',
                title: summary,
                subtitle: 'Auto-refresh is off — stay on this page as long as you like.',
                ttl: 5000
            });
            return;
        }

        if (uploadInFlight()) {
            console.warn(LOG, 'Reload skipped: another upload is still in progress.');
            showToast({
                kind: 'success',
                title: summary,
                subtitle: 'Another upload is in progress — automatic refresh skipped.',
                ttl: 6000
            });
            return;
        }

        cancelReload();

        const deadline = Date.now() + config.delayMs;
        const toast = showToast({
            kind: 'success',
            title: summary,
            subtitle: 'Reloading in ' + humanDelay(config.delayMs),
            action: {
                label: 'Cancel refresh',
                onClick: (instance) => {
                    cancelReload();
                    console.info(LOG, 'Automatic refresh cancelled by the user.');
                    instance.subEl.textContent = 'Refresh cancelled — you can keep working on this page.';
                    instance.reset(6000);
                }
            },
            ttl: config.delayMs + 5000
        });

        state.countdownInterval = setInterval(() => {
            const left = deadline - Date.now();
            if (left <= 0 || !toast) return;
            toast.subEl.textContent = 'Reloading in ' + (Math.max(left, 0) / 1000).toFixed(1) + 's';
        }, 250);

        state.reloadTimeout = setTimeout(() => {
            cancelReload();
            window.location.reload();
        }, config.delayMs);
    }

    function scan() {
        if (!config.enabled) return;
        if (!uploadSucceeded()) return;

        const links = collectLinks();
        if (!links.length) {
            if (config.debug) console.debug(LOG, 'Success banner detected, waiting for the links to render…');
            return;
        }

        const signature = links.map((link) => link.viewer).join('|');
        if (signature === state.signature) return; // already handled this batch

        if (state.signature && signature !== state.signature) {
            console.info(LOG, 'A new upload batch was detected — handling it.');
            cancelReload();
        }

        state.signature = signature;
        handleBatch(links);
    }

    function scheduleScan() {
        if (state.scanTimer) return;
        state.scanTimer = setTimeout(() => {
            state.scanTimer = null;
            try {
                scan();
            } catch (error) {
                console.error(LOG, 'Scan failed.', error);
            }
        }, 150);
    }

    /* ------------------------------------------------------------------ *
     * 7. Notifications, shortcuts and Tampermonkey menu.
     * ------------------------------------------------------------------ */
    function desktopNotify(title, text) {
        if (!config.desktopNotify || !document.hidden) return;
        if (typeof GM_notification !== 'function') return;
        try {
            GM_notification({ title, text, timeout: 6000, silent: true });
        } catch (error) {
            console.warn(LOG, 'Desktop notification failed.', error);
        }
    }

    function copyAgain() {
        if (!state.links.length) {
            showToast({
                kind: 'error',
                title: 'Nothing to copy yet',
                subtitle: 'Upload an image first — links are remembered for this page only.',
                ttl: 5000
            });
            return;
        }
        const text = state.links.map((link) => FORMATS[config.format].build(link)).join('\n');
        copyText(text).then((ok) => {
            showToast({
                kind: ok ? 'success' : 'error',
                title: ok ? 'Copied ' + state.links.length + ' link' + (state.links.length === 1 ? '' : 's') + ' again' : 'Clipboard blocked',
                subtitle: ok ? FORMATS[config.format].label : 'Check the browser console for the raw links.',
                ttl: 3500
            });
            if (!ok) console.log(LOG, 'Links:\n' + text);
        });
    }

    let menuIds = [];

    function addMenu(label, handler) {
        try {
            const id = GM_registerMenuCommand(label, handler);
            if (id !== undefined && id !== null) menuIds.push(id);
        } catch (error) {
            console.warn(LOG, 'Could not register the menu command "' + label + '".', error);
        }
    }

    function refreshMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;

        if (typeof GM_unregisterMenuCommand === 'function') {
            for (const id of menuIds) {
                try {
                    GM_unregisterMenuCommand(id);
                } catch (error) {
                    if (config.debug) console.warn(LOG, 'Could not unregister menu command ' + id + '.', error);
                }
            }
        }
        menuIds = [];

        addMenu((config.enabled ? '✅' : '⛔') + ' Auto copy: ' + (config.enabled ? 'ON' : 'OFF') + ' — click to toggle', () => {
            setConfig('enabled', !config.enabled);
            showToast({
                kind: 'info',
                title: 'Auto copy ' + (config.enabled ? 'enabled' : 'disabled'),
                subtitle: config.enabled ? 'New uploads will be copied automatically.' : 'Nothing will be copied until you turn it back on.',
                ttl: 3500
            });
        });

        addMenu((config.autoRefresh ? '🔄' : '⏸') + ' Auto refresh: ' + (config.autoRefresh ? 'ON' : 'OFF') + ' — click to toggle', () => {
            setConfig('autoRefresh', !config.autoRefresh);
            showToast({
                kind: 'info',
                title: 'Auto refresh ' + (config.autoRefresh ? 'enabled' : 'disabled'),
                subtitle: config.autoRefresh ? 'The page will reload ' + humanDelay(config.delayMs) + ' after each upload.' : 'The page stays open after each upload.',
                ttl: 3500
            });
        });

        addMenu('⏱ Reload delay: ' + humanDelay(config.delayMs) + ' — click to cycle', () => {
            const index = DELAY_STEPS.indexOf(config.delayMs);
            const next = DELAY_STEPS[(index + 1) % DELAY_STEPS.length];
            setConfig('delayMs', next);
            showToast({ kind: 'info', title: 'Reload delay: ' + humanDelay(next), ttl: 3000 });
        });

        addMenu('📋 Copy format: ' + FORMATS[config.format].label + ' — click to cycle', () => {
            const keys = Object.keys(FORMATS);
            const next = keys[(keys.indexOf(config.format) + 1) % keys.length];
            setConfig('format', next);
            showToast({ kind: 'info', title: 'Copy format: ' + FORMATS[next].label, ttl: 3000 });
        });

        addMenu('🔁 Copy the last links again (Alt+Shift+C)', copyAgain);

        addMenu('↺ Reset settings to defaults', () => {
            for (const key of Object.keys(DEFAULTS)) {
                config[key] = DEFAULTS[key];
                store.set(key, DEFAULTS[key]);
            }
            refreshMenu();
            showToast({ kind: 'info', title: 'Settings reset to defaults', ttl: 3000 });
        });
    }

    /* ------------------------------------------------------------------ *
     * 8. Boot.
     * ------------------------------------------------------------------ */
    function onShortcut(event) {
        if (!event.altKey || !event.shiftKey || event.key.toLowerCase() !== 'c') return;
        event.preventDefault();
        copyAgain();
    }

    function start() {
        const target = document.body;
        if (!target) {
            setTimeout(start, 100);
            return;
        }

        const observer = new MutationObserver(scheduleScan);
        observer.observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-result', 'href']
        });

        window.addEventListener('pagehide', cancelReload);
        document.addEventListener('keydown', onShortcut);

        refreshMenu();
        scheduleScan();

        if (config.debug) console.log(LOG, 'Ready on ' + location.href + ' (format: ' + config.format + ', delay: ' + humanDelay(config.delayMs) + ').');
    }

    start();
})();
