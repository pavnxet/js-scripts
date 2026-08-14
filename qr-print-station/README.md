# A5 QR Print Station

A polished, browser-based QR/image layout studio for preparing A5 print sheets.

## What’s new in the current version

### ✨ New visual design
- Modern glass-style interface with a cleaner workspace.
- Smoother hover, press, drag, menu, toast, and sheet animations.
- Responsive layout for smaller screens.
- Dark/light theme with browser-local persistence.
- Zoomable sheet preview.

### 🧰 New productivity features
- **QR color controls** for foreground and background.
- Optional **QR slot labels** while generating a code.
- **Contain / Cover** image-fit toggle per slot.
- **Shuffle filled slots**.
- Improved duplicate, rotate, clear, and context-menu actions.
- **Redo** support in addition to undo.
- Up to **30 undo/redo history states**.
- Local browser **autosave** so the working layout can survive a reload.
- Reset workspace action.
- Animated feedback/toasts for important actions.

### 📐 Layout & printing
- A5 portrait sheet.
- Grid presets: 2×2, 3×3, 4×4, 5×5, 6×6, or custom up to 10×10.
- Adjustable slot gap and sheet padding in millimetres.
- Dashed, solid, or hidden slot borders.
- Drag/drop images directly onto a specific slot.
- Drag/drop QR/image slots to rearrange them.
- Batch image upload fills available empty slots automatically.
- PNG export using a 300-DPI target scale.
- Direct A5 print layout with print-only CSS.

## Keyboard shortcuts

- `Delete` — clear selected slot
- `R` — rotate selected slot 90°
- `D` — duplicate selected slot
- `Ctrl + Z` — undo
- `Ctrl + Y` — redo
- `Esc` — deselect
- Right-click — open slot actions

## Usage

Open `index.html` directly in a modern browser. No build step or application server is required.

For printing, use:

- **Orientation:** A5 Portrait
- **Paper size:** A5
- **Scale:** Actual size / 100%
- **Background graphics:** On

## External libraries

The app uses these browser-side CDN libraries:

- QRCode.js — QR generation.
- html2canvas — high-resolution PNG export.

## Privacy

The application is client-side. Uploaded images, generated QR codes, and layouts are processed in the browser. Layout autosave uses the browser's local storage; there is no application backend in this folder.

## Repository structure

```text
qr-print-station/
├── index.html
└── README.md
```
