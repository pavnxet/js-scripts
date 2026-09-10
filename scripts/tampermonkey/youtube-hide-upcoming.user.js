// ==UserScript==
// @name         YouTube Subscriptions - Hide Upcoming Cards (Debugged v5.0)
// @namespace    https://github.com/
// @version      5.0
// @description  Deeply debugged script to permanently hide Upcoming/Premiere video cards on YouTube.
// @author       AI Assistant
// @match        *://*.youtube.com/*
// @icon         https://www.youtube.com/favicon.ico
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let isEnabled = GM_getValue("hideUpcomingEnabled", true);

    const styleTag = document.createElement('style');
    styleTag.id = 'yt-hide-upcoming-style';
    styleTag.textContent = `
        ytd-rich-item-renderer[data-yt-upcoming="true"],
        ytd-grid-video-renderer[data-yt-upcoming="true"],
        ytd-video-renderer[data-yt-upcoming="true"] {
            display: none !important;
        }
    `;
    (document.head || document.documentElement).appendChild(styleTag);

    function setupMenu() {
        const label = isEnabled ? "❌ Hide Upcoming: ON (Click to OFF)" : "✅ Hide Upcoming: OFF (Click to ON)";
        GM_registerMenuCommand(label, function() {
            isEnabled = !isEnabled;
            GM_setValue("hideUpcomingEnabled", isEnabled);
            location.reload();
        });
    }
    setupMenu();

    const upcomingRegex = /upcoming|scheduled|premiere|waiting|live in|आने वाली|शेड्यूल|प्रीमियर/i;

    function scanAndHideCards() {
        if (!isEnabled) {
            document.querySelectorAll('[data-yt-upcoming="true"]').forEach(el => el.removeAttribute('data-yt-upcoming'));
            return;
        }

        const cards = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');

        cards.forEach(card => {
            let isUpcoming = false;

            const badges = card.querySelectorAll(
                'ytd-thumbnail-overlay-time-status-renderer, ' +
                '.yt-badge-shape__text, ' +
                'badge-shape, ' +
                '#time-status, ' +
                '.badge-style-type-live-now-alternate'
            );

            for (let b of badges) {
                if (upcomingRegex.test(b.textContent || "")) {
                    isUpcoming = true;
                    break;
                }
            }

            if (!isUpcoming) {
                const ariaElements = card.querySelectorAll('[aria-label]');
                for (let a of ariaElements) {
                    if (upcomingRegex.test(a.getAttribute('aria-label') || "")) {
                        isUpcoming = true;
                        break;
                    }
                }
            }

            if (!isUpcoming && upcomingRegex.test(card.innerText || "")) {
                isUpcoming = true;
            }

            if (isUpcoming) {
                card.setAttribute('data-yt-upcoming', 'true');
            }
        });
    }

    window.addEventListener('yt-navigate-finish', scanAndHideCards);
    window.addEventListener('scroll', scanAndHideCards, { passive: true });

    const observer = new MutationObserver(() => {
        scanAndHideCards();
    });

    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            scanAndHideCards();
        } else {
            requestAnimationFrame(startObserver);
        }
    };
    startObserver();
})();
