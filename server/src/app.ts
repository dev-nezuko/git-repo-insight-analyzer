import express from "express";
import cors from "cors";
import { reposRouter } from "./routes/repos.js";
import { chatRouter } from "./routes/chat.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/repos", reposRouter);
  app.use("/api/chat", chatRouter);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    res.status(400).json({ message });
  });

  return app;
}
