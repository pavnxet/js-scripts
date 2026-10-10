// ==UserScript==
// @name         YouTube Subscriptions → CSV
// @namespace    https://github.com/pavnxet/js-scripts
// @version      1.0.0
// @description  Exports every subscribed channel (canonical UC... ID, URL, title) to CSV. Adds an on-page button and auto-scrolls the list so the full subscription set is captured.
// @author       pavnxet
// @match        https://www.youtube.com/feed/channels*
// @icon         https://www.youtube.com/favicon.ico
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

/**
 * YouTube Subscriptions -> CSV (Tampermonkey)
 * ---------------------------------------------------------------------------
 * The console version of this script requires the user to scroll the whole
 * subscription list manually before running. This userscript does that part
 * for you: it scrolls until no new channel cards appear, then exports.
 *
 * WHERE IT RUNS
 *   https://www.youtube.com/feed/channels — a button appears bottom-right.
 *
 * OUTPUT
 *   Downloads `youtube_subscriptions.csv` with the header:
 *   Channel ID,Channel URL,Channel Title
 *
 * NOTES
 *   - The visible channel URL is usually /@handle, which does NOT contain the
 *     canonical ID. The UC... ID is read from the renderer's Polymer data.
 *   - Missing IDs are written as the literal sentinel `ID_NOT_FOUND` rather
 *     than an empty cell, so gaps are visible in the output.
 *   - Dependency-free IIFE: leaks nothing to `window`.
 * ---------------------------------------------------------------------------
 */
(function () {
    'use strict';

    // --- Tunables ----------------------------------------------------------
    var SCROLL_DELAY_MS = 900;     // wait for lazy-loaded cards after each scroll
    var STABLE_ROUNDS = 3;         // consecutive no-growth rounds before stopping
    var MAX_ROUNDS = 200;          // hard safety cap against infinite scroll
    var CARD_SELECTOR = 'ytd-grid-channel-renderer, ytd-channel-renderer';

    var running = false;

    // --- CSV helpers -------------------------------------------------------

    /** Wrap a value as a CSV field, escaping quotes and stripping newlines. */
    function csvField(value) {
        return '"' + String(value == null ? '' : value)
            .replace(/\r?\n/g, ' ')
            .replace(/"/g, '""')
            .trim() + '"';
    }

    /** Resolve the canonical UC... channel ID from Polymer bound data. */
    function resolveChannelId(el) {
        return el.data?.channelId ||
               el.data?.navigationEndpoint?.browseEndpoint?.browseId ||
               el.__data?.data?.navigationEndpoint?.browseEndpoint?.browseId ||
               'ID_NOT_FOUND';
    }

    /** Collect every channel card currently in the DOM, de-duplicated. */
    function collectChannels() {
        var cards = Array.prototype.slice.call(document.querySelectorAll(CARD_SELECTOR));
        var byKey = new Map();
        var missingIds = 0;

        cards.forEach(function (el) {
            var titleEl = el.querySelector('#title, #channel-title');
            var linkEl = el.querySelector('a#main-link, a#thumbnail, a.ytd-simple-endpoint');
            if (!titleEl || !linkEl) {
                return;
            }

            var channelId = resolveChannelId(el);
            if (channelId === 'ID_NOT_FOUND') {
                missingIds++;
            }

            // Prefer the UC id as the key; fall back to the URL when unavailable,
            // so a duplicate card is never counted twice.
            var key = channelId !== 'ID_NOT_FOUND' ? channelId : linkEl.href;
            if (!byKey.has(key)) {
                byKey.set(key, [channelId, linkEl.href, csvField(titleEl.textContent)]);
            }
        });

        return { rows: Array.from(byKey.values()), missingIds: missingIds };
    }

    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    // --- Scrolling ---------------------------------------------------------

    /**
     * Scroll to the bottom repeatedly until the card count and page height stop
     * growing. Returns the number of scroll rounds performed.
     */
    async function scrollUntilComplete(onProgress, shouldStop) {
        var lastCount = -1;
        var lastHeight = -1;
        var stable = 0;
        var round = 0;

        for (; round < MAX_ROUNDS; round++) {
            if (shouldStop()) {
                break;
            }

            var cards = document.querySelectorAll(CARD_SELECTOR);
            var scroller = document.scrollingElement || document.documentElement;

            if (cards.length) {
                // Nudging the last card into view is a more reliable lazy-load
                // trigger than a bare window.scrollTo on YouTube's feed layout.
                cards[cards.length - 1].scrollIntoView({ block: 'end' });
            }
            window.scrollTo(0, scroller.scrollHeight);

            await sleep(SCROLL_DELAY_MS);

            var count = document.querySelectorAll(CARD_SELECTOR).length;
            var height = scroller.scrollHeight;
            onProgress(count, round + 1);

            if (count === lastCount && height === lastHeight) {
                stable++;
                if (stable >= STABLE_ROUNDS) {
                    break;
                }
            } else {
                stable = 0;
            }
            lastCount = count;
            lastHeight = height;
        }

        return round + 1;
    }

    // --- Export ------------------------------------------------------------

    function downloadCsv(rows) {
        var lines = ['Channel ID,Channel URL,Channel Title'].concat(
            rows.map(function (r) { return r.join(','); })
        );

        // BOM keeps non-ASCII titles (emoji, Devanagari, etc.) readable in Excel.
        var blob = new Blob(['\uFEFF' + lines.join('\n') + '\n'], {
            type: 'text/csv;charset=utf-8;'
        });

        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'youtube_subscriptions.csv';
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    /** Full flow: scroll the list, then export what was rendered. */
    async function runExport(ui) {
        if (running) {
            return;
        }
        running = true;
        ui.setBusy(true);

        try {
            ui.status('Scrolling to load all channels…');

            var rounds = await scrollUntilComplete(
                function (count, round) {
                    ui.status('Loading… ' + count + ' channel(s) found (round ' + round + ')');
                },
                function () { return !running; }
            );

            var result = collectChannels();

            if (result.rows.length === 0) {
                ui.status('No channels found. Scroll the list once and retry.', true);
                console.error(
                    '[youtube-subscriptions-to-csv] No channel cards found at ' +
                    location.href + ' — the page may still be loading.'
                );
                return;
            }

            downloadCsv(result.rows);

            var summary = 'Exported ' + result.rows.length + ' channel(s) in ' +
                rounds + ' scroll round(s).';
            if (result.missingIds) {
                summary += ' ' + result.missingIds + ' card(s) had no readable ID (ID_NOT_FOUND).';
            }
            ui.status(summary);
            console.log('[youtube-subscriptions-to-csv] ' + summary);
        } catch (err) {
            ui.status('Export failed — see console for details.', true);
            console.error('[youtube-subscriptions-to-csv]', err);
        } finally {
            running = false;
            ui.setBusy(false);
        }
    }

    // --- On-page UI --------------------------------------------------------

    function buildPanel() {
        var host = document.createElement('div');
        host.style.cssText = [
            'position:fixed', 'right:18px', 'bottom:18px', 'z-index:99999',
            'font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
            'display:flex', 'flex-direction:column', 'gap:6px',
            'align-items:flex-end', 'pointer-events:none'
        ].join(';');

        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Subscriptions → CSV';
        button.style.cssText = [
            'pointer-events:auto', 'cursor:pointer', 'border:1px solid #303030',
            'background:#0f0f0f', 'color:#f1f1f1', 'border-radius:999px',
            'padding:9px 16px', 'font:inherit', 'font-weight:600',
            'box-shadow:0 2px 10px rgba(0,0,0,.35)', 'transition:transform .15s ease'
        ].join(';');
        button.addEventListener('mouseenter', function () { button.style.transform = 'translateY(-1px)'; });
        button.addEventListener('mouseleave', function () { button.style.transform = 'none'; });
        button.addEventListener('click', function () { runExport(ui); });

        var status = document.createElement('div');
        status.style.cssText = [
            'pointer-events:auto', 'max-width:320px', 'text-align:right',
            'background:#212121', 'color:#f1f1f1', 'border-radius:8px',
            'padding:6px 10px', 'font-size:12px', 'display:none',
            'box-shadow:0 2px 10px rgba(0,0,0,.35)'
        ].join(';');

        host.appendChild(button);
        host.appendChild(status);
        document.body.appendChild(host);

        var ui = {
            setBusy: function (busy) {
                button.disabled = busy;
                button.style.opacity = busy ? '0.65' : '1';
                button.style.cursor = busy ? 'progress' : 'pointer';
                button.textContent = busy ? 'Working…' : 'Subscriptions → CSV';
            },
            status: function (message, isError) {
                status.textContent = message;
                status.style.display = 'block';
                status.style.background = isError ? '#3a1d1d' : '#212121';
            }
        };

        return ui;
    }

    function init() {
        if (!/^\/feed\/channels/.test(location.pathname)) {
            return;
        }
        var ui = buildPanel();

        // Also reachable from the Tampermonkey menu, without the on-page button.
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('Export subscriptions to CSV', function () { runExport(ui); });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
