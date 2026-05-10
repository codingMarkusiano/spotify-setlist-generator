# Spotify Setlist Generator

Sign in with Spotify, paste a playlist URL → download a printable A4 `.docx` setlist.

One page, one button. No database, no payments.

## Stack

- Next.js 16 (App Router) + TypeScript strict (`noUncheckedIndexedAccess`)
- Tailwind CSS v4
- [`docx`](https://docx.js.org) for Office Open XML generation
- Spotify Web API — **Authorization Code (user OAuth) flow**, session in an encrypted cookie
- Zod for validation, Vitest for unit tests
- Deploys to Vercel

## Setup

### 1. Create a Spotify app

Go to https://developer.spotify.com/dashboard → **Create app**.

- **Redirect URIs** — add the exact URLs your app will use. Spotify requires `127.0.0.1` (not `localhost`) for HTTP redirect URIs:
  - Dev: `http://127.0.0.1:3000/api/auth/callback`
  - Production (after first deploy): `https://your-app.vercel.app/api/auth/callback`
- Save the **Client ID** and **Client Secret**.

### 2. Configure `.env.local`

```bash
cp .env.local.example .env.local
```

Fill in:

| Var | What |
| --- | --- |
| `SPOTIFY_CLIENT_ID` | From dashboard |
| `SPOTIFY_CLIENT_SECRET` | From dashboard |
| `SPOTIFY_REDIRECT_URI` | Must exactly match a redirect URI registered in the dashboard |
| `SESSION_SECRET` | 32-byte hex; generate with `openssl rand -hex 32` |

### 3. Run dev

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:3000** (use `127.0.0.1`, not `localhost` — cookies are bound to the hostname you started auth on, and your Spotify redirect URI is registered for `127.0.0.1`). Click **Conectar con Spotify**, authorize, then paste a playlist URL.

## Spotify Development Mode caveat

By default new Spotify apps are in **Development Mode**. In that mode the user-OAuth token only grants access to playlists the user owns or follows. Other public playlists return `403` (mapped to `playlist_not_found` in our API), and editorial `37i9…` playlists return `404`.

To unblock access to any public playlist, apply for **Extended Quota Mode** in the Spotify dashboard (form + review).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (one-shot) |
| `npm run test:watch` | Vitest in watch mode |

`scripts/check-docx.ts` writes four sample `.docx` files to `scripts/out/` (no Spotify creds required) for visual layout checks. `scripts/check-end-to-end.ts` runs the full server-side pipeline against a real playlist URL (needs `SPOTIFY_USER_ACCESS_TOKEN` from a successful OAuth login).

## Deploy (Vercel)

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the repo into Vercel.
3. In **Project → Settings → Environment Variables**, set the four env vars from `.env.local` for Production, Preview, and Development environments. For each environment, `SPOTIFY_REDIRECT_URI` must point to the deployed origin — e.g. `https://your-app.vercel.app/api/auth/callback`.
4. Add that production redirect URI to the Spotify app's **Redirect URIs** list in the dashboard.
5. Deploy. The default Next.js build is sufficient — no custom build command, no `vercel.json` needed.

The API route runs on Vercel Functions (Fluid Compute, Node.js runtime) with the default 300s timeout — more than enough for the largest playlist.

## Layout / behavior notes

- DOCX layout auto-scales: small playlists render at 28pt with expanded line spacing (capped at 2.4×) so the page fills; medium fits at the natural exact-fit size in `[18, 28]pt`; long playlists add pages before ever dipping below 18pt (hard floor 14pt). The footer (`Duración total: …`) is glued to the last track via `keepNext`/`keepLines` so it never strands on its own page.
- Track lines use `lineRule: exact` so the rendered line height is literally `fontSize × lineHeightFactor` points, matching the page-budget math (Word's `auto` rule otherwise inflates lines by Helvetica's ~1.15× single-line metric and pushes content off the page).
- Helvetica throughout the document; A4 with 1cm top/bottom and 2cm left/right margins.
- The API route enforces an in-memory rate limit of 10 requests per IP per minute. Resets on cold start — fine for the MVP.
- Session cookie is AES-256-GCM-encrypted with `SESSION_SECRET`, `HttpOnly`, `SameSite=Lax`, 30-day max-age. Access tokens refresh transparently when within 60s of expiry.
