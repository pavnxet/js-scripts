# A5 QR Print Station

A lightweight, browser-based QR/image layout tool for preparing an A5 print sheet.

## Features

- Generate QR codes from URLs or text.
- Place QR codes into an A5 sheet grid.
- Upload multiple images at once.
- Drag and drop to rearrange slots.
- Grid presets: 2×2, 3×3, 4×4, 5×5, 6×6, or a custom grid up to 10×10.
- Adjust slot gap and sheet padding in millimetres.
- Choose dashed, solid, or no slot borders.
- Edit slot labels with the context menu.
- Rotate and duplicate slots.
- Undo up to 20 changes.
- Save and load layouts as JSON files.
- Export the A5 sheet as a PNG at a 300-dpi target width.
- Print directly using an A5 portrait print layout.
- Toggle dark mode.
- Keyboard shortcuts for common actions.

## Usage

Open `index.html` directly in a modern browser. No build step or server is required.

For printing, use:

- **Orientation:** A5 Portrait
- **Paper size:** A5
- **Scale:** Actual size / 100%
- **Background graphics:** On

## External libraries

The app loads these libraries from CDN when needed:

- [QRCode.js](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js) — QR generation.
- [html2canvas](https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js) — PNG export.

`html2canvas` is loaded dynamically only when the PNG export function is used.

## Repository structure

```text
qr-print-station/
├── index.html
└── README.md
```

## Notes

The application is client-side only. Uploaded images and saved layouts are handled in the browser; there is no application backend in this folder.
