// ==UserScript==
// @name         Reddit Sidebar Resizer
// @namespace    https://github.com/pavnxet/js-scripts
// @version      1.0.0
// @description  Adds a draggable divider to resize Reddit's right sidebar. The width is remembered and re-applied automatically across Reddit's single-page navigation.
// @author       pavnxet
// @match        https://www.reddit.com/*
// @icon         https://www.reddit.com/favicon.ico
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

/**
 * Reddit Sidebar Resizer (Tampermonkey)
 * ---------------------------------------------------------------------------
 * The console snippet version has to be re-pasted after every full page load.
 * This userscript installs itself once and — because Reddit is a single-page
 * app — re-applies the layout after in-app navigation as well.
 *
 * WHERE IT RUNS
 *   https://www.reddit.com/* — on pages that render `.main-container`,
 *   `main.main` and `.right-sidebar` (the current Reddit layout).
 *
 * NOTES
 *   - Shares the same localStorage key as the console snippet
 *     (`reddit-sidebar-width`), so a width set with either version is picked
 *     up by both.
 *   - Dragging narrower than 80px snaps the sidebar fully shut.
 *   - Width is clamped to 700px, and the main column never shrinks below 300px.
 *   - Only widths greater than 0 are persisted, so a collapsed sidebar does
 *     not survive a reload.
 * ---------------------------------------------------------------------------
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'reddit-sidebar-width';
    const RESIZER_ID = 'custom-resizer';
    const MIN_SIDEBAR = 80;   // narrower than this snaps the sidebar shut
    const MAX_SIDEBAR = 700;
    const MIN_MAIN = 300;     // never let the main column get smaller than this
    const REMOUNT_DEBOUNCE_MS = 250;
    const WARN_AFTER_MS = 15000;

    let isResizing = false;
    let ownMutation = false;
    let queued = null;

    /** Reddit re-renders these nodes on navigation, so always look them up fresh. */
    function elements() {
        return {
            mainContainer: document.querySelector('.main-container'),
            mainContent: document.querySelector('main.main'),
            rightSidebar: document.querySelector('.right-sidebar')
        };
    }

    function savedWidth() {
        try {
            return localStorage.getItem(STORAGE_KEY) || '316';
        } catch (err) {
            return '316';
        }
    }

    /** Apply the grid layout. Returns false when the layout nodes are absent. */
    function applyLayout(sWidth) {
        const { mainContainer, mainContent, rightSidebar } = elements();
        if (!mainContainer || !mainContent || !rightSidebar) {
            return false;
        }

        mainContainer.style.display = 'grid';
        mainContainer.style.gridTemplateColumns = '1fr 1px ' + sWidth + 'px'; // 1px divider
        mainContainer.style.maxWidth = '100%';
        mainContainer.style.gap = '0';
        mainContainer.classList.remove(
            'grid-cols-[minmax(0,1fr)]',
            'xs:[&.fixed-sidebar]:grid-cols-[minmax(0,756px)_minmax(0,316px)]'
        );
        mainContent.style.maxWidth = 'none';
        rightSidebar.style.maxWidth = 'none';
        // Number() matters: during a drag the width is a number (0), while the
        // value restored from localStorage is a string. A strict `=== '0'`
        // check would never match a dragged 0 and the sidebar would stay visible.
        rightSidebar.style.display = Number(sWidth) === 0 ? 'none' : 'block';
        return true;
    }

    function lineOf(resizer) {
        return resizer ? resizer.querySelector('.visual-line') : null;
    }

    /** Build the divider handle. Document-level drag listeners are attached once, below. */
    function createResizer(mainContent) {
        const resizer = document.createElement('div');
        resizer.id = RESIZER_ID;
        resizer.style.cssText = [
            'width:10px', 'cursor:col-resize', 'position:relative', 'z-index:100',
            'margin:0 -5px', 'background:transparent', 'display:flex', 'justify-content:center'
        ].join(';');

        resizer.innerHTML = [
            '<div class="visual-line" style="',
            'width:1px;height:100%;',
            'background:rgba(255,255,255,0.15);',
            'transition:all 0.2s;',
            '"></div>'
        ].join('');

        mainContent.after(resizer);

        const vLine = lineOf(resizer);

        resizer.addEventListener('mouseenter', () => {
            vLine.style.background = 'rgba(255, 255, 255, 0.5)';
            vLine.style.width = '2px';
        });

        resizer.addEventListener('mouseleave', () => {
            if (isResizing) return;
            vLine.style.background = 'rgba(255, 255, 255, 0.15)';
            vLine.style.width = '1px';
        });

        resizer.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            vLine.style.background = '#0079d3'; // active blue
            vLine.style.width = '2px';
        });
    }

    /**
     * Make sure the layout is applied and the divider exists.
     * Safe to call repeatedly; returns true when Reddit's layout nodes exist.
     */
    function mount() {
        const { mainContent } = elements();
        if (!mainContent) {
            return false;
        }

        if (!applyLayout(savedWidth())) {
            return false;
        }

        ownMutation = true;
        try {
            const existing = document.getElementById(RESIZER_ID);
            if (existing && !existing.isConnected) {
                existing.remove();
            }
            if (!document.getElementById(RESIZER_ID)) {
                createResizer(mainContent);
            }
        } finally {
            // MutationObserver records from our own changes are delivered as a
            // microtask, before this macrotask runs — so they get ignored.
            setTimeout(() => { ownMutation = false; }, 0);
        }
        return true;
    }

    function schedule() {
        if (queued) return;
        queued = setTimeout(() => {
            queued = null;
            mount();
        }, REMOUNT_DEBOUNCE_MS);
    }

    // --- Drag handling: attached once, never per-mount ---
    document.addEventListener('mousemove', (event) => {
        if (!isResizing) return;
        const { mainContainer } = elements();
        if (!mainContainer) return;

        const rect = mainContainer.getBoundingClientRect();
        let sidebarWidth = rect.right - event.clientX;

        if (sidebarWidth < MIN_SIDEBAR) sidebarWidth = 0;
        if (sidebarWidth > MAX_SIDEBAR) sidebarWidth = MAX_SIDEBAR;

        const mainWidth = rect.width - sidebarWidth - 1;
        if (mainWidth <= MIN_MAIN) return;

        applyLayout(sidebarWidth);
        if (sidebarWidth > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, sidebarWidth);
            } catch (err) {
                console.error('[reddit-sidebar-resizer] Could not save width', err);
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        const vLine = lineOf(document.getElementById(RESIZER_ID));
        if (vLine) {
            vLine.style.background = 'rgba(255, 255, 255, 0.15)';
            vLine.style.width = '1px';
        }
    });

    // --- Re-mount after Reddit's SPA navigation / re-render ---
    const observer = new MutationObserver(() => {
        if (ownMutation || isResizing) return;
        schedule();
    });

    function start() {
        mount();

        // Debounced watcher: Reddit swaps large parts of the DOM on navigation,
        // which removes both our divider and the inline grid styles.
        observer.observe(document.documentElement, { childList: true, subtree: true });
        window.addEventListener('popstate', schedule);

        // Fail loudly if the layout never appears, instead of staying silent.
        setTimeout(() => {
            if (!mount()) {
                console.error(
                    '[reddit-sidebar-resizer] Could not find .main-container / main.main / ' +
                    '.right-sidebar after ' + (WARN_AFTER_MS / 1000) + 's. Reddit may have changed ' +
                    'its layout, or this page does not use the sidebar layout.'
                );
            }
        }, WARN_AFTER_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
