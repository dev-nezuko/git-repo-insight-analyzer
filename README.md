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

Production build: `npm run build` — compiles **`server/dist`** (API) and **`client/dist`** (Vite SPA). Production runs **`node server/dist/index.js`** from the repo root; the server serves `client/dist` when present.

## Deploy on Render

Web Service from this repo root: `npm install --include=dev && npm run build` (or **`npm run build:render`** if your dashboard already uses that), start `node server/dist/index.js`, health check `GET /health`. Set environment variables from [`.env.example`](.env.example) (`MONGODB_URI`, optional OpenAI/AWS). Same-origin **`/api/...`** in production (omit `VITE_API_URL`).

## API

- `POST /api/repos/import` `{ "githubUrl": "https://github.com/owner/repo" }`
- `POST /api/chat/sessions` `{ "repoId": "<id>" }`
- `POST /api/chat/:sessionId/ask` `{ "question": "How does auth work?" }`
- `GET /api/chat/:sessionId/history`
