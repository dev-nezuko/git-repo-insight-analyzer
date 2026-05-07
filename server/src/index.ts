import path from "node:path";
import { existsSync } from "node:fs";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { createApp } from "./app.js";
import { isBedrockConfigured } from "./services/bedrockSynthesizer.js";

async function bootstrap(): Promise<void> {
  const bedrockReady = isBedrockConfigured();

  const clientDist = path.resolve(process.cwd(), "client", "dist");
  const webRoot = existsSync(path.join(clientDist, "index.html")) ? clientDist : undefined;
  if (webRoot) {
    console.log(`Serving web UI from ${webRoot}`);
  }

  const app = createApp(webRoot);
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.port, "0.0.0.0", () => {
      console.log(`Server listening on 0.0.0.0:${env.port}`);
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

  try {
    await connectMongo(env.mongoUri);
    console.log("MongoDB connected");
  } catch (error) {
    // Keep serving /health and the UI; API requests retry the connection.
    console.error(`MongoDB not reachable yet: ${error instanceof Error ? error.message : String(error)}`);
  }
}

bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
