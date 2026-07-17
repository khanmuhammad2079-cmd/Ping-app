# Pings — Frontend

Real Vite + React project, ported from the Claude Artifact prototype. Runs standalone.

## Run it locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Best viewed at mobile width — use your browser's device toolbar (Chrome DevTools → Toggle device toolbar) to preview it like a phone.

## Build for production

```bash
npm run build
```

Outputs static files to `dist/` — deployable to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static host.

### Quick deploy to Vercel
```bash
npm i -g vercel
vercel
```
Follow the prompts — it auto-detects Vite and builds correctly with no config needed.

### Quick deploy to Netlify
```bash
npm i -g netlify-cli
netlify deploy --build
```

## ⚠️ Before this works for real users

Three things in `src/App.jsx` call `https://api.anthropic.com` directly, and one fetches RSS through a public CORS proxy (`allorigins.win`). These worked automatically inside the Claude Artifacts sandbox but **will not work once deployed on their own** — no API key travels with the request, and calling Anthropic directly from a browser isn't a safe pattern (it would expose your key to anyone who opens dev tools).

The `pings-backend` project (shared earlier) has the exact same logic running server-side already — RSS fetching, headline rewriting, category classification, and quiz generation. Once that backend is deployed:

1. Search `src/App.jsx` for `api.anthropic.com` and `allorigins.win` to find the 4 call sites.
2. Replace them with `fetch` calls to your backend's `/news`, `/vocabulary`, `/gk`, and `/exam/quiz` endpoints instead.
3. Add a `.env` file with `VITE_API_BASE=https://your-backend-url.com` and reference it via `import.meta.env.VITE_API_BASE` in those calls.

Until then, the app runs and every UI interaction works — saved items, settings, quizzes, badges, navigation — but live news won't load and AI-powered features (headline rewriting, category classification, saved-GK quiz generation) will fail silently or show empty states.

## Turning this into a native mobile app

Once you're happy with it as a website, wrap it with [Capacitor](https://capacitorjs.com) to ship to the Play Store / App Store without rewriting anything:

```bash
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/ios @capacitor/android
npx cap init
npx cap add android
npx cap add ios
npm run build
npx cap sync
npx cap open android   # or: npx cap open ios
```

## Project structure

```
index.html          entry HTML, viewport meta for mobile
src/
  main.jsx           mounts <App /> into #root
  App.jsx            the entire app — all components, all state, all styling (inline <style> tag)
public/
  favicon.svg        the Pings two-dot mark
```

Everything currently lives in one `App.jsx` file (~8,400 lines), matching how it was built as a single artifact. It works fine as-is, but if the codebase keeps growing, it's worth splitting into `src/components/`, `src/data/`, and `src/hooks/` — ask if you'd like that done.
