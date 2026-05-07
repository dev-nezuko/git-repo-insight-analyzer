import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config();
config({ path: path.resolve(process.cwd(), ".env") });
config({ path: path.resolve(process.cwd(), "..", ".env") });

const schema = z.object({
  PORT: z.string().default("4000"),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/codebase-investigator"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.1),
  // Optional: AWS Bedrock (Claude, etc.). Prefer IAM roles in production — not long-lived keys in .env.
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_BEDROCK_MODEL_ID: z.string().optional()
});

const parsed = schema.parse(process.env);

export const env = {
  port: Number(parsed.PORT),
  mongoUri: parsed.MONGODB_URI,
  openAiApiKey: parsed.OPENAI_API_KEY,
  openAiModel: parsed.OPENAI_MODEL,
  openAiTemperature: parsed.OPENAI_TEMPERATURE,
  awsAccessKeyId: parsed.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: parsed.AWS_SECRET_ACCESS_KEY,
  awsRegion: parsed.AWS_REGION,
  awsBedrockModelId: parsed.AWS_BEDROCK_MODEL_ID
};
