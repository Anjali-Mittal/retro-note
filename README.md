> *send love, wrapped in vinyl*

**retro note** is a vintage-aesthetic web app for crafting and sharing heartfelt letters — complete with photos, a personal song, and a handwritten note — all wrapped up in a beautiful vinyl + envelope collage.

Live at → [retro-note-eight.vercel.app](https://retro-note-eight.vercel.app)

---

## ✨ Features

- **Compose a letter** — Write a personal note with a warm, old-paper aesthetic. The letter is tucked inside an envelope; clicking the envelope reveals it with a satisfying open animation.
- **Photo memories** — Upload up to 6 photos (jpg, png, webp · max 8 MB each).
  - A single photo is rendered as a poloaroid.
  - Multiple photos are arranged as a classic **film strip**.
- **Song for the vinyl** — Attach any audio file to the letter. Use the trim selector to choose **which 30-second clip** to include (up to 30s max). Recipients click the spinning vinyl record to play it.
- **Shareable link** — Each letter is stored via **Cloudinary** and served over a unique URL (e.g. `/letter#<id>.json`), so you can send it to anyone with just a link.
- **Retro UI** — Cream parchment tones, serif typography, and a vinyl record hero animation set the mood throughout.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React + TypeScript (Vite) |
| Storage | Cloudinary (unsigned upload — no backend secrets needed) |
| Styling | Tailwind CSS + custom CSS (theme, vinyl, fonts) |
| Package Manager | pnpm |
| Hosting | Vercel |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- pnpm (`npm install -g pnpm`)
- A [Cloudinary](https://cloudinary.com/) account with an **unsigned upload preset**

### Installation

```bash
git clone https://github.com/Anjali-Mittal/retro-note.git
cd retro-note
pnpm install
```

### Cloudinary Setup

This project uses **unsigned Cloudinary uploads** — no API secret or `.env` file required. Open `src/app/ts/encoding.ts` (or wherever the upload preset is configured) and replace the placeholder values with your own:

```ts
const CLOUDINARY_CLOUD_NAME = "your_cloud_name";
const CLOUDINARY_UPLOAD_PRESET = "your_unsigned_preset";
```

### Run Locally

```bash
pnpm dev
```

Open [http://localhost:5713](http://localhost:5713) in your browser.

---

## 📬 How It Works

1. Visit the homepage and click **Compose a Letter**.
2. Drop up to 6 photos into the memory zone.
3. Choose an audio file — it will be trimmed to 30 seconds and embedded in the vinyl.
4. Write your note and add your name.
5. Click **Preview & Send** to generate a shareable link.
6. Share the link — the recipient sees the vinyl + envelope + film strip collage, and can click to read the letter and play the song.

---

## 📁 Project Structure

```
retro-note/
├── src/
│   ├── app/
│   │   ├── ts/
│   │   │   ├── audio.ts        # Audio trimming & upload logic
│   │   │   ├── collage.ts      # Film strip / portrait collage builder
│   │   │   ├── encoding.ts     # Cloudinary unsigned upload config
│   │   │   ├── retro.ts        # Core letter data model
│   │   │   ├── session.ts      # Session / letter state management
│   │   │   └── utils.ts        # Shared utilities
│   │   └── App.tsx             # Root component
│   ├── styles/
│   │   ├── fonts.css
│   │   ├── index.css
│   │   ├── landing.css
│   │   ├── letter-page.css
│   │   ├── tailwind.css
│   │   ├── theme.css
│   │   ├── vinyl-base.css
│   │   ├── vinyl-components.css
│   │   ├── vinyl-layout.css
│   │   └── vinyl-vinyl.css
│   └── main.tsx                # Entry point
├── index.html
├── package.json
├── pnpm-workspace.yaml
├── postcss.config.mjs
└── tailwind / vite config
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---

## 👩‍💻 Author

Made with love by [Anjali Mittal](https://github.com/Anjali-Mittal)
