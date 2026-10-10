/**
 * YouTube Subscriptions -> CSV
 * ---------------------------------------------------------------------------
 * Exports every subscribed channel rendered on YouTube's Subscriptions
 * management page to a CSV file containing the canonical Channel ID (UC...),
 * the channel URL, and the channel title.
 *
 * WHERE TO RUN
 *   1. Open  https://www.youtube.com/feed/channels
 *   2. Scroll to the BOTTOM of the list repeatedly until no new channels load.
 *      YouTube lazy-loads the grid, so channels that were never scrolled into
 *      view are not in the DOM and cannot be exported.
 *   3. Open DevTools (F12) -> Console tab, paste this file, press Enter.
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
 *   - Dependency-free IIFE: safe to re-run, leaks nothing to `window`.
 * ---------------------------------------------------------------------------
 */
(function () {
    'use strict';

    var channels = Array.prototype.slice.call(
        document.querySelectorAll('ytd-grid-channel-renderer, ytd-channel-renderer')
    );

    if (channels.length === 0) {
        console.error(
            'No channels found. Make sure you are on https://www.youtube.com/feed/channels ' +
            'and that the subscription list has finished loading.'
        );
        return;
    }

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

    var rows = ['Channel ID,Channel URL,Channel Title'];
    var missingIds = 0;

    channels.forEach(function (el) {
        var titleEl = el.querySelector('#title, #channel-title');
        var linkEl = el.querySelector('a#main-link, a#thumbnail, a.ytd-simple-endpoint');

        if (!titleEl || !linkEl) {
            return;
        }

        var channelId = resolveChannelId(el);
        if (channelId === 'ID_NOT_FOUND') {
            missingIds++;
        }

        rows.push([channelId, linkEl.href, csvField(titleEl.textContent)].join(','));
    });

    // BOM keeps non-ASCII titles (emoji, Devanagari, etc.) readable in Excel.
    var blob = new Blob(['\uFEFF' + rows.join('\n') + '\n'], {
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

    console.log(
        'Exported ' + (rows.length - 1) + ' channel(s) to youtube_subscriptions.csv' +
        (missingIds ? ' (' + missingIds + ' with ID_NOT_FOUND - selectors may need updating)' : '') + '.'
    );
})();
