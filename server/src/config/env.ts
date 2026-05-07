import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

config();
config({ path: path.resolve(process.cwd(), ".env") });
config({ path: path.resolve(process.cwd(), "..", ".env") });

function emptyToUndefined<V>(raw: unknown): V | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    return (t === "" ? undefined : t) as V | undefined;
  }
  return raw as V;
}

/** Host part of `mongodb+srv://[user:pass@]host/database` before `/` or `?`. */
function mongodbSrvHost(uri: string): string | undefined {
  if (!uri.startsWith("mongodb+srv://")) return undefined;
  let rest = uri.slice("mongodb+srv://".length);
  const at = rest.indexOf("@");
  if (at >= 0) rest = rest.slice(at + 1);
  const slash = rest.indexOf("/");
  const query = rest.indexOf("?");
  let end = rest.length;
  if (slash >= 0) end = Math.min(end, slash);
  if (query >= 0) end = Math.min(end, query);
  const hostPort = rest.slice(0, end).trim();
  if (!hostPort) return undefined;
  return hostPort.split(":")[0];
}

const schema = z.object({
  PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(65535).default(4000)
  ),
  MONGODB_URI: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .default("mongodb://127.0.0.1:27017/codebase-investigator")
      .superRefine((uri, ctx) => {
        if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "MONGODB_URI must start with mongodb:// or mongodb+srv:// (e.g. full Atlas URI from Database → Connect → Drivers)."
          });
          return;
        }
        const srvHost = mongodbSrvHost(uri);
        if (
          srvHost &&
          (/^\d+$/.test(srvHost) || (srvHost.length <= 3 && !srvHost.includes(".")))
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              `MONGODB_URI SRV hostname looks invalid (${JSON.stringify(srvHost)}). In Render → Environment, set the full Atlas connection string whose host resembles cluster0.xxxxx.mongodb.net, not a placeholder or partial value. querySrv ENOTFOUND _mongodb._tcp.* usually means the host segment after @ was wrong.`
          });
        }
      })
  ),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.preprocess(emptyToUndefined, z.string().default("gpt-4o")),
  OPENAI_TEMPERATURE: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(0).max(1).default(0.1)
  ),
  // Optional: AWS Bedrock (Claude, etc.). Prefer IAM roles in production — not long-lived keys in .env.
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_BEDROCK_MODEL_ID: z.string().optional()
});

const parsedResult = schema.safeParse(process.env);
if (!parsedResult.success) {
  // eslint-disable-next-line no-console
  console.error("[investigator-server] Invalid environment:");
  for (const iss of parsedResult.error.issues) {
    const pathKeys = iss.path.map(String).join(".");
    // eslint-disable-next-line no-console
    console.error(`  ${pathKeys || "(root)"}: ${iss.message}`);
  }
  process.exit(1);
}
const parsed = parsedResult.data;

export const env = {
  port: parsed.PORT,
  mongoUri: parsed.MONGODB_URI,
  openAiApiKey: parsed.OPENAI_API_KEY,
  openAiModel: parsed.OPENAI_MODEL,
  openAiTemperature: parsed.OPENAI_TEMPERATURE,
  awsAccessKeyId: parsed.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: parsed.AWS_SECRET_ACCESS_KEY,
  awsRegion: parsed.AWS_REGION,
  awsBedrockModelId: parsed.AWS_BEDROCK_MODEL_ID
};
