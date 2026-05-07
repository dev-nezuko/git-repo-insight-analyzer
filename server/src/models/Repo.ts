import { Schema, model } from "mongoose";

const RepoSchema = new Schema(
  {
    githubUrl: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    defaultBranch: { type: String, default: "main" },
    status: {
      type: String,
      enum: ["queued", "processing", "ready", "failed"],
      default: "queued"
    },
    fileCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    lastError: { type: String }
  },
  { timestamps: true }
);

export const RepoModel = model("Repo", RepoSchema);
