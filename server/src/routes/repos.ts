import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { importRepository } from "../services/ingestion.js";
import { RepoModel } from "../models/Repo.js";

const bodySchema = z.object({
  githubUrl: z.string().max(300)
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
    const repo = isValidObjectId(req.params.repoId) ? await RepoModel.findById(req.params.repoId).lean() : null;
    if (!repo) {
      return res.status(404).json({ message: "Repo not found" });
    }
    return res.json(repo);
  } catch (error) {
    return next(error);
  }
});
