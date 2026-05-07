import { Schema, model } from "mongoose";

const RepoFileSchema = new Schema(
  {
    repoId: { type: Schema.Types.ObjectId, ref: "Repo", required: true, index: true },
    filePath: { type: String, required: true, index: true },
    topLevelDir: { type: String, required: true, index: true },
    extension: { type: String, required: true },
    lineCount: { type: Number, required: true },
    isEntryCandidate: { type: Boolean, default: false },
    isConfig: { type: Boolean, default: false },
    isSource: { type: Boolean, default: false }
  },
  { timestamps: true }
);

RepoFileSchema.index({ repoId: 1, filePath: 1 }, { unique: true });

export const RepoFileModel = model("RepoFile", RepoFileSchema);
