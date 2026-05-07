/**
 * Vercel Express entry (see https://vercel.com/docs/frameworks/backend/express).
 * Default export must be the Express app — not serverless-http. Static UI is served from /public (Vite outDir); express.static is ignored on Vercel.
 */
import { createApp } from "./server/dist/src/app.js";

export default createApp();
