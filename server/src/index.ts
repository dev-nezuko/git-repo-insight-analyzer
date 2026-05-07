import path from "node:path";
import { existsSync } from "node:fs";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { createApp } from "./app.js";

async function bootstrap(): Promise<void> {
  const bedrockReady =
    env.awsAccessKeyId &&
    env.awsSecretAccessKey &&
    env.awsRegion &&
    env.awsBedrockModelId;

  const clientDist = path.resolve(process.cwd(), "client", "dist");
  const webRoot = existsSync(path.join(clientDist, "index.html")) ? clientDist : undefined;
  if (webRoot) {
    // eslint-disable-next-line no-console
    console.log(`Serving web UI from ${webRoot}`);
  }

  const app = createApp(webRoot);
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.port, "0.0.0.0", () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on 0.0.0.0:${env.port}`);
      // eslint-disable-next-line no-console
      console.log(
        bedrockReady
          ? `LLM: AWS Bedrock (${env.awsBedrockModelId}) — falls back to OpenAI if Bedrock fails`
          : env.openAiApiKey
            ? `LLM: OpenAI (${env.openAiModel})`
            : "LLM synthesis disabled — set OPENAI_* or AWS Bedrock env vars"
      );
      resolve();
    });
    server.on("error", reject);
  });

  await connectMongo(env.mongoUri);
  // eslint-disable-next-line no-console
  console.log("MongoDB connected");
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
