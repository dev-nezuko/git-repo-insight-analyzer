import { Schema, model } from "mongoose";

const ChunkSchema = new Schema(
  {
    repoId: { type: Schema.Types.ObjectId, ref: "Repo", required: true, index: true },
    filePath: { type: String, required: true, index: true },
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    content: { type: String, required: true },
    contentHash: { type: String, required: true },
    embedding: { type: [Number], default: [] }
  },
  { timestamps: true }
);

ChunkSchema.index({ repoId: 1, content: "text", filePath: "text" });

export const ChunkModel = model("Chunk", ChunkSchema);
