import { Router } from "express";
import { z } from "zod";
import { importRepository } from "../services/ingestion.js";
import { RepoModel } from "../models/Repo.js";

const bodySchema = z.object({
  githubUrl: z.string().url()
});

export const reposRouter = Router();

reposRouter.post("/import", async (req, res, next) => {
  try {
    const payload = bodySchema.parse(req.body);
    const result = await importRepository(payload.githubUrl);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

reposRouter.get("/:repoId", async (req, res, next) => {
  try {
    const repo = await RepoModel.findById(req.params.repoId).lean();
    if (!repo) {
      return res.status(404).json({ message: "Repo not found" });
    }
    return res.json(repo);
  } catch (error) {
    return next(error);
  }
});
