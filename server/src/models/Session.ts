import { Schema, model } from "mongoose";

const SessionSchema = new Schema(
  {
    repoId: { type: Schema.Types.ObjectId, ref: "Repo", required: true, index: true },
    title: { type: String, default: "Investigation Session" }
  },
  { timestamps: true }
);

export const SessionModel = model("Session", SessionSchema);
