import { Schema, model } from "mongoose";

const CitationSchema = new Schema(
  {
    chunkId: { type: String, required: true },
    filePath: { type: String, required: true },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true }
  },
  { _id: false }
);

const ClaimSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    topicKey: { type: String, required: true },
    polarity: { type: String, enum: ["positive", "negative", "neutral"], required: true },
    citations: { type: [CitationSchema], default: [] }
  },
  { _id: false }
);

const AuditSchema = new Schema(
  {
    verdict: { type: String, enum: ["pass", "warn", "fail"], required: true },
    trustScore: { type: Number, required: true },
    issues: { type: [Schema.Types.Mixed], default: [] },
    checks: { type: Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const TurnSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    citations: { type: [CitationSchema], default: [] },
    claims: { type: [ClaimSchema], default: [] },
    audit: { type: AuditSchema, required: true },
    changedStance: { type: String }
  },
  { timestamps: true }
);

export const TurnModel = model("Turn", TurnSchema);
