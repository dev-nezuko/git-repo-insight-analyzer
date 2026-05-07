import path from "node:path";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { chatRouter } from "./routes/chat.js";
import { reposRouter } from "./routes/repos.js";

/** When `webRootAbsolute` points at `client/dist` with `index.html`, SPA + API share one origin (e.g. Render). */
export function createApp(webRootAbsolute?: string): express.Express {
  const app = express();
  app.use(cors());

  // Liveness only — must not wait on Mongo so platforms (e.g. Render) see an open port while Atlas allowlist is misconfigured.
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  let dbReady: Promise<void> | undefined;
  const ensureDb = (): Promise<void> => {
    dbReady ??= connectMongo(env.mongoUri);
    return dbReady;
  };
  app.use((_req, _res, next) => {
    void ensureDb().then(() => next()).catch(next);
  });

  app.use(express.json({ limit: "2mb" }));

  app.use("/api/repos", reposRouter);
  app.use("/api/chat", chatRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  const webRoot = webRootAbsolute?.trim();
  const indexHtml =
    webRoot !== undefined && webRoot !== "" ? path.resolve(webRoot, "index.html") : undefined;

  if (webRoot !== undefined && webRoot !== "" && indexHtml !== undefined) {
    app.use(express.static(webRoot));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(indexHtml, (err) => {
        if (err) next(err);
      });
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    res.status(400).json({ message });
  });

  return app;
}
