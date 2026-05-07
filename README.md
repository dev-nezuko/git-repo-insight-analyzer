# Codebase Investigator (MERN MVP)

MERN-style investigator that:
- imports a public GitHub repository,
- answers plain-English code questions with file/line citations,
- runs an independent audit on each non-trivial answer,
- tracks turn-to-turn stance changes to keep long investigations coherent.

## Run

1. Copy `.env.example` to `.env` (server env: MongoDB, optional OpenAI/Bedrock).
2. Install deps:
   - `npm install`
3. Start app:
   - `npm run dev`

Backend: `http://localhost:4000`  
Frontend: `http://localhost:5173`

Production build (same as Vercel build step): `npm run build` — compiles `server/dist` and writes the Vite app to **`public/`** at the repo root.

## Deploy on Vercel (full stack, one project)

[Vercel](https://vercel.com) serves the UI from **`public/`** (`outputDirectory` **`public`**, or leave the default). The API runs as **Express** from [`src/index.ts`](src/index.ts) per [Express on Vercel](https://vercel.com/docs/frameworks/backend/express). The browser calls **`/api/...`** on the same domain (no `VITE_API_URL` required).

1. **MongoDB Atlas** (or compatible URI) — required. Large GitHub imports hit your function time limit; upgrade to a plan with **longer max duration** if imports time out.
2. In Vercel → **Settings → Environment Variables**, add everything your server needs from [`.env.example`](.env.example) (e.g. `MONGODB_URI`, AWS/OpenAI keys).
3. Deploy. The client uses same-origin `/api` in production (`import.meta.env.PROD`).

Optional: set **`VITE_API_URL`** only if the API is hosted on a **different** origin than the static site.

Notes:
- Repo zips are unpacked under **`/tmp`** on serverless (see `server/src/services/ingestion.ts`); **nothing is persisted across cold starts** unless you move storage to Mongo/S3/etc.
- **Hobby** plans have shorter function timeouts; big repos may need **Pro** or a dedicated Node host.

## API

- `POST /api/repos/import` `{ "githubUrl": "https://github.com/owner/repo" }`
- `POST /api/chat/sessions` `{ "repoId": "<id>" }`
- `POST /api/chat/:sessionId/ask` `{ "question": "How does auth work?" }`
- `GET /api/chat/:sessionId/history`
