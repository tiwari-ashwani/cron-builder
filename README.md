# ⚡ Cron Expression Builder

An AI-powered cron expression builder with bidirectional conversion — type in plain English to get a cron expression, or paste a cron expression to get a plain English explanation. Includes a visual editor, common presets, and a live preview of the next 5 scheduled run times.

---

## 🖥️ Live Demo

> Deploy on Netlify and paste your URL here

---

## ✨ Features

- **AI Assistant** — powered by Claude (Anthropic)
  - **English → Cron** — type `"every weekday at 8:30 AM"` and get `30 8 * * 1-5`
  - **Cron → English** — paste `*/15 9-17 * * 1-5` and get a plain English explanation
  - Toggle between modes with a single click
- **Visual Editor** — edit each cron field (Minute / Hour / DOM / Month / DOW) individually
- **Plain English readout** — instant static translation of the current expression
- **10 common presets** — one-click shortcuts for everyday schedules
- **Next 5 scheduled runs** — shows exact upcoming dates with relative time (in 2h 30m, in 3d, etc.)
- **Copy button** — copies the expression to clipboard instantly
- **Secure API proxy** — Anthropic API key is never exposed to the browser

---

## 🚀 Getting Started

### Prerequisites

- Node.js `v20.19+` or `v22+`
- npm
- An [Anthropic API key](https://console.anthropic.com) for the AI features

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/cron-builder.git
cd cron-builder

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

> **Note:** The AI feature calls `/api/ai` which only works on Netlify (via the serverless function). To test AI locally, see the [Local AI Testing](#local-ai-testing) section below.

---

## 📦 Build & Deploy

### Build for production

```bash
npm run build
```

This generates a `dist/` folder.

### Deploy to Netlify

**Step 1 — Push to GitHub:**
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/cron-builder.git
git branch -M main
git push -u origin main
```

**Step 2 — Connect to Netlify:**
1. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
2. Select your GitHub repo
3. Build settings are auto-filled from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy Site**

**Step 3 — Add your Anthropic API key:**
1. In Netlify → **Site configuration → Environment variables**
2. Click **Add a variable**
3. Key: `ANTHROPIC_API_KEY` · Value: `sk-ant-api03-xxxxxxxx...`
4. Save, then go to **Deploys → Trigger deploy → Deploy site**

Every future `git push` auto-redeploys. 🔄

---

## 🔑 Getting an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / Log in
3. Click **API Keys** in the sidebar
4. Click **Create Key**, give it a name
5. Copy it immediately — you won't see it again

> New accounts get **$5 free credits** — enough for thousands of AI conversions.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| AI Model | Claude (claude-sonnet-4-20250514) |
| API Proxy | Netlify Functions (serverless) |
| Styling | Inline CSS + Google Fonts |
| Fonts | IBM Plex Mono + Playfair Display |

---

## 📁 Project Structure

```
cron-builder/
├── netlify/
│   └── functions/
│       └── ai.js          # Serverless proxy — keeps API key secure
├── src/
│   ├── App.jsx            # Main component (all logic + UI)
│   ├── index.css          # Empty (styles are inline)
│   └── main.jsx           # React entry point
├── index.html
├── netlify.toml           # Build + redirect config
├── vite.config.js
└── package.json
```

---

## 🔒 Security

The Anthropic API key is stored as a **Netlify environment variable** and only used inside the serverless function (`netlify/functions/ai.js`). It is never bundled into the frontend or exposed to the browser.

The frontend calls `/api/ai` → Netlify redirects to `/.netlify/functions/ai` → the function injects the key server-side before calling Anthropic.

---

## 🧠 Local AI Testing

The AI feature requires the Netlify function to inject the API key. To test it locally:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Create a .env file
echo "ANTHROPIC_API_KEY=sk-ant-api03-your-key-here" > .env

# Run with Netlify dev (spins up functions locally too)
netlify dev
```

Open `http://localhost:8888` — AI features will work fully.

---

## ✏️ Cron Syntax Reference

| Field | Values | Special |
|---|---|---|
| Minute | 0–59 | `*` `*/5` `0,30` |
| Hour | 0–23 | `*` `*/6` `9-17` |
| Day of Month | 1–31 | `*` `1` `15` |
| Month | 1–12 | `*` `1,6,12` |
| Day of Week | 0–6 (Sun=0) | `*` `1-5` `0,6` |

---

## 🤝 Contributing

Pull requests are welcome! For major changes, open an issue first.

---

## 📄 License

MIT
