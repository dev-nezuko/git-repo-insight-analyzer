import { Router } from "express";
import { z } from "zod";
import { SessionModel } from "../models/Session.js";
import { TurnModel } from "../models/Turn.js";
import { retrieveRelevantChunks } from "../services/retrieval.js";
import { buildAnswer } from "../services/answerer.js";
import { runAudit } from "../services/auditor.js";
import { detectChangedStance } from "../services/claimLedger.js";
import type { Claim } from "../types/investigator.js";
import { applyAuditGate } from "../services/responseGate.js";
import { buildStructureAnswer } from "../services/structureAnswer.js";
import { getRepoStructureContext } from "../services/repoStructure.js";

const startSessionSchema = z.object({
  repoId: z.string(),
  title: z.string().optional()
});

const askSchema = z.object({
  question: z.string().min(5)
});

export const chatRouter = Router();

chatRouter.post("/sessions", async (req, res, next) => {
  try {
    const payload = startSessionSchema.parse(req.body);
    const session = await SessionModel.create({
      repoId: payload.repoId,
      title: payload.title ?? "Investigation Session"
    });
    return res.status(201).json({ sessionId: String(session._id) });
  } catch (error) {
    return next(error);
  }
});

chatRouter.post("/:sessionId/ask", async (req, res, next) => {
  try {
    const payload = askSchema.parse(req.body);
    const session = await SessionModel.findById(req.params.sessionId).lean();
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const structure = await getRepoStructureContext(String(session.repoId));
    const structuredDraft = await buildStructureAnswer(String(session.repoId), payload.question);
    const chunks = structuredDraft ? [] : await retrieveRelevantChunks(String(session.repoId), payload.question, 8);
    const responseDraft = structuredDraft ?? (await buildAnswer(payload.question, chunks, structure.summaryText));

    const priorTurns = await TurnModel.find({ sessionId: session._id }).lean();
    const previousClaims = priorTurns.flatMap((turn) => ((turn.claims as Claim[] | undefined) ?? []));
    const changedStance = detectChangedStance(previousClaims, responseDraft.claims);

    const audit = await runAudit(payload.question, responseDraft.answer, responseDraft.citations);
    const gatedAnswer = applyAuditGate(responseDraft.answer, responseDraft.nonTrivial, audit.verdict);

    const turn = await TurnModel.create({
      sessionId: session._id,
      question: payload.question,
      answer: gatedAnswer,
      citations: responseDraft.citations,
      claims: responseDraft.claims,
      audit,
      changedStance
    });

    return res.status(201).json({
      turnId: String(turn._id),
      answer: gatedAnswer,
      citations: responseDraft.citations,
      audit,
      changedStance
    });
  } catch (error) {
    return next(error);
  }
});

chatRouter.get("/:sessionId/history", async (req, res, next) => {
  try {
    const turns = await TurnModel.find({ sessionId: req.params.sessionId })
      .sort({ createdAt: 1 })
      .lean();
    return res.json({ turns });
  } catch (error) {
    return next(error);
  }
});
