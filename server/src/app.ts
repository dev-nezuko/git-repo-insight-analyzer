import path from "node:path";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { HttpError } from "./httpError.js";
import { chatRouter } from "./routes/chat.js";
import { reposRouter } from "./routes/repos.js";

/** When `webRootAbsolute` points at `client/dist` with `index.html`, SPA + API share one origin (e.g. Render). */
export function createApp(webRootAbsolute?: string): express.Express {
  const app = express();
  app.disable("x-powered-by");
  // The API can download archives on a caller's behalf, so only listed browser origins may call it.
  app.use(cors({ origin: env.corsOrigins }));

  // Liveness only — must not wait on Mongo so platforms (e.g. Render) see an open port while Atlas allowlist is misconfigured.
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // connectMongo shares one in-flight attempt and forgets a failed one, so a database that
  // comes up after the server does is picked up on the next request.
  app.use("/api", (_req, _res, next) => {
    connectMongo(env.mongoUri).then(() => next(), next);
  });

  app.use(express.json({ limit: "64kb" }));

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
    app.get("/{*spaPath}", (req, res, next) => {
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
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    if (error instanceof ZodError) {
      const detail = error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
      res.status(400).json({ message: `Invalid request. ${detail}` });
      return;
    }
    if (error instanceof mongoose.Error.CastError) {
      res.status(400).json({ message: `Invalid ${error.path}.` });
      return;
    }
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: `Invalid ${Object.keys(error.errors).join(", ")}.` });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ message: "Request body is not valid JSON." });
      return;
    }
    if (error instanceof Error && error.name === "MongooseServerSelectionError") {
      res.status(503).json({ message: "Database unavailable. Check MONGODB_URI and that MongoDB is running." });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Unexpected server error." });
  });

  return app;
}
