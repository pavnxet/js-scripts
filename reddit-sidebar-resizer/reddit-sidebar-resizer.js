/**
 * Reddit Sidebar Resizer
 * ---------------------------------------------------------------------------
 * Adds a draggable divider between Reddit's main content column and the right
 * sidebar, so the sidebar width can be dragged to whatever you like. The
 * chosen width is saved in localStorage and restored the next time you run it.
 *
 * WHERE TO RUN
 *   https://www.reddit.com/* — on a page that renders `.main-container`,
 *   `main.main` and `.right-sidebar` (the current Reddit layout).
 *   Paste into the DevTools console.
 *
 * OUTPUT
 *   No download. It mutates the live layout in place and logs one line.
 *
 * NOTES
 *   - This is a console snippet, so a full page reload drops it. Reddit is a
 *     single-page app, so ordinary in-app navigation usually preserves it —
 *     but reload and you will need to paste it again.
 *   - Dragging the divider narrower than 80px snaps the sidebar fully shut.
 *   - Sidebar width is clamped to 700px, and the main column is never allowed
 *     to shrink below 300px.
 *   - Only a width greater than 0 is persisted, so a fully collapsed sidebar
 *     does not survive a reload.
 * ---------------------------------------------------------------------------
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'reddit-sidebar-width';
    const MIN_SIDEBAR = 80;   // narrower than this snaps the sidebar shut
    const MAX_SIDEBAR = 700;
    const MIN_MAIN = 300;     // never let the main column get smaller than this

    const mainContainer = document.querySelector('.main-container');
    const mainContent = document.querySelector('main.main');
    const rightSidebar = document.querySelector('.right-sidebar');

    // Fail loudly instead of returning silently: this normally means the page
    // is still rendering, or Reddit changed its layout class names.
    if (!mainContainer || !mainContent || !rightSidebar) {
        console.error(
            '[reddit-sidebar-resizer] Required elements not found ' +
            '(.main-container / main.main / .right-sidebar). Make sure you are on a ' +
            'reddit.com page using the current layout and that it has finished rendering.'
        );
        return;
    }

    document.querySelectorAll('#custom-resizer').forEach(el => el.remove());

    const savedWidth = localStorage.getItem(STORAGE_KEY) || '316';

    const setupLayout = (sWidth) => {
        mainContainer.style.display = 'grid';
        mainContainer.style.gridTemplateColumns = `1fr 1px ${sWidth}px`; // 1px divider
        mainContainer.style.maxWidth = '100%';
        mainContainer.style.gap = '0';
        mainContainer.classList.remove(
            'grid-cols-[minmax(0,1fr)]',
            'xs:[&.fixed-sidebar]:grid-cols-[minmax(0,756px)_minmax(0,316px)]'
        );
        mainContent.style.maxWidth = 'none';
        rightSidebar.style.maxWidth = 'none';
        // Number() matters: during a drag sWidth is a number (0), while the value
        // restored from localStorage is a string ('316'). A strict `=== '0'` check
        // would never match the dragged number and the sidebar would stay visible.
        rightSidebar.style.display = Number(sWidth) === 0 ? 'none' : 'block';
    };

    setupLayout(savedWidth);

    let isResizing = false;

    // 1. The resizer — a thin divider line that is always visible
    const resizer = document.createElement('div');
    resizer.id = 'custom-resizer';
    resizer.style.cssText = `
        width: 10px;
        cursor: col-resize;
        position: relative;
        z-index: 100;
        margin: 0 -5px;
        background: transparent;
        display: flex;
        justify-content: center;
    `;

    resizer.innerHTML = `
        <div class="visual-line" style="
            width: 1px;
            height: 100%;
            background: rgba(255, 255, 255, 0.15);
            transition: all 0.2s;
        "></div>
    `;

    mainContent.after(resizer);
    const vLine = resizer.querySelector('.visual-line');

    // 2. Hover interaction — make the line a little more obvious
    resizer.onmouseenter = () => {
        vLine.style.background = 'rgba(255, 255, 255, 0.5)';
        vLine.style.width = '2px';
    };

    resizer.onmouseleave = () => {
        if (isResizing) return;
        vLine.style.background = 'rgba(255, 255, 255, 0.15)';
        vLine.style.width = '1px';
    };

    resizer.onmousedown = () => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        vLine.style.background = '#0079d3'; // active blue
        vLine.style.width = '2px';
    };

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerRect = mainContainer.getBoundingClientRect();
        let sidebarWidth = containerRect.right - e.clientX;

        if (sidebarWidth < MIN_SIDEBAR) sidebarWidth = 0;
        if (sidebarWidth > MAX_SIDEBAR) sidebarWidth = MAX_SIDEBAR;

        const mainWidth = containerRect.width - sidebarWidth - 1;

        if (mainWidth > MIN_MAIN) {
            setupLayout(sidebarWidth);
            if (sidebarWidth > 0) localStorage.setItem(STORAGE_KEY, sidebarWidth);
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        resizer.onmouseleave();
    });

    console.log('[reddit-sidebar-resizer] Ready — drag the thin divider between content and sidebar.');
})();
