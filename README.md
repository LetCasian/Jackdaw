# Jackdaw

> *Collect what catches your eye.*

A lightweight, always-on-top reference companion for artists. Built for digital painters, illustrators, and concept artists who keep Photoshop open all day and need a calm, organized space for their reference images.

Named after the [jackdaw](https://en.wikipedia.org/wiki/Western_jackdaw) — the small corvid famous for its striking pale-blue eyes and its habit of collecting bright, beautiful things.

---

## Download

Grab the latest installer from the [Releases page](../../releases):

- **Windows** — `Jackdaw-Setup-x.x.x.exe`
- **macOS** — `Jackdaw-x.x.x.dmg`
- **Linux** — `Jackdaw-x.x.x.AppImage`

Or run from source (see below).

---

## Features

**Stays out of your way**
- Always-on-top window that floats over Photoshop
- Resizable to any shape and size
- Adjustable opacity — see through it while painting

**Organize visually**
- Collections with editable titles
- Hide collections you're not currently using
- Collapse/expand to focus
- Masonry grid (2-5 columns)
- Drag images between collections

**Drag in & out of Photoshop**
- Drag images **out** of Jackdaw straight onto your Photoshop canvas
- Drag images **in** from Photoshop, Explorer, or your browser
- `Ctrl+V` to paste from clipboard

**Edit references in place**
- Rotate left / right (90° steps)
- Flip horizontal / vertical (great for anatomy)
- Transforms are kept when you drag the image into Photoshop

**Find what you saved**
- Live search across collection names and notes
- Double-click any image for full-screen preview
- Notes in golden cards
- Everything saved automatically

---

## Run from source

### Prerequisites
- [Node.js](https://nodejs.org/) v18-v22 (LTS recommended)

```bash
cd jackdaw
npm install
npm start
```

### Build your own installer

```bash
# Windows .exe
npm run dist:win

# macOS .dmg
npm run dist:mac

# Linux AppImage
npm run dist:linux
```

The installer appears in the `dist/` folder.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+I` | Add images |
| `Ctrl+G` | New collection |
| `Ctrl+F` | Search |
| `Ctrl+V` | Paste image from clipboard |
| `Ctrl+Shift+J` | Summon window (global) |
| `Esc` | Close preview / search / dialogs |
| Double-click title | Rename collection |
| Double-click image | Full-screen preview |
| Hover an image | Rotate & flip toolbar appears |

---

## How drag & drop with Photoshop works

**Out of Jackdaw → Photoshop**: just drag any image from a collection and drop it onto the Photoshop canvas. Jackdaw writes the image (with your rotation/flip applied) to a temp file and hands it to Photoshop as a new layer.

**Into Jackdaw ← Photoshop**: in Photoshop, the cleanest way is to drag a layer or selection out to the desktop (or use File > Export), then drop that file onto Jackdaw. Direct layer-drag depends on your Photoshop version; dropping image files always works.

> Note: dragging *raw layers* directly out of Photoshop is a Photoshop limitation, not Jackdaw's — Photoshop only exposes file drops in most versions. Dropping any image file into Jackdaw is fully supported.

---

## Project structure

```
jackdaw/
├── package.json
├── .github/workflows/build.yml   CI: auto-builds installers on release
└── src/
    ├── main.js         Electron main process + drag-out + file storage
    ├── preload.js      secure bridge
    ├── index.html      UI structure
    ├── styles.css      dark theme + Jackdaw palette
    ├── renderer.js     UI logic, rotate/flip, drag handling
    └── assets/         icons & logo
```

### Data location

| OS | Path |
|---|---|
| Windows | `%APPDATA%\jackdaw\` |
| macOS | `~/Library/Application Support/jackdaw/` |
| Linux | `~/.config/jackdaw/` |

Collections live in `jackdaw-data.json`; dragged-out images are cached in the `images/` subfolder.

---

## License

MIT — fork it, modify it, sell it, give it away.

---

*"Like the jackdaw, we collect the bright things that catch our eye."*
