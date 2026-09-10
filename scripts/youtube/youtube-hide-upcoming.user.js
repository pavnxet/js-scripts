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

    // 1. ग्लोबल CSS इंजेक्ट करें (ताकि यूट्यूब इसे दोबारा ओवरराइड न कर सके)
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

    // 2. Tampermonkey मेनू टॉगल
    function setupMenu() {
        const label = isEnabled ? "❌ Hide Upcoming: ON (Click to OFF)" : "✅ Hide Upcoming: OFF (Click to ON)";
        GM_registerMenuCommand(label, function() {
            isEnabled = !isEnabled;
            GM_setValue("hideUpcomingEnabled", isEnabled);
            location.reload();
        });
    }
    setupMenu();

    // 3. अपकमिंग स्टेटस चेक करने के लिए मल्टी-लैंग्वेज Regex
    const upcomingRegex = /upcoming|scheduled|premiere|waiting|live in|आने वाली|शेड्यूल|प्रीमियर/i;

    function scanAndHideCards() {
        if (!isEnabled) {
            // अगर टॉगल बंद है तो छुपाए गए सभी कार्ड्स को वापस लाएं
            document.querySelectorAll('[data-yt-upcoming="true"]').forEach(el => el.removeAttribute('data-yt-upcoming'));
            return;
        }

        // यूट्यूब के सभी प्रकार के वीडियो कार्ड्स ढूँढें
        const cards = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');

        cards.forEach(card => {
            let isUpcoming = false;

            // टेस्ट A: ओवरले बैज (यूट्यूब का नया लेआउट)
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

            // टेस्ट B: थंबनेल के अंदर लिंक्स या aria-label
            if (!isUpcoming) {
                const ariaElements = card.querySelectorAll('[aria-label]');
                for (let a of ariaElements) {
                    if (upcomingRegex.test(a.getAttribute('aria-label') || "")) {
                        isUpcoming = true;
                        break;
                    }
                }
            }

            // टेस्ट C: साधारण टेक्स्ट कंटेंट (Fallback)
            if (!isUpcoming && upcomingRegex.test(card.innerText || "")) {
                isUpcoming = true;
            }

            // अगर अपकमिंग है, तो कार्ड को कस्टम एट्रिब्यूट देकर CSS से हाइड करें
            if (isUpcoming) {
                card.setAttribute('data-yt-upcoming', 'true');
            }
        });
    }

    // 4. पेज नेविगेशन और स्क्रॉलिंग हैंडलर
    window.addEventListener('yt-navigate-finish', scanAndHideCards);
    window.addEventListener('scroll', scanAndHideCards, { passive: true });

    const observer = new MutationObserver(() => {
        scanAndHideCards();
    });

    // डॉक्युमेंट बॉडी आते ही ऑब्जर्वर शुरू करें
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
