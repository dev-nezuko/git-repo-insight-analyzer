import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { createApp } from "./app.js";

async function bootstrap(): Promise<void> {
  const bedrockReady =
    env.awsAccessKeyId &&
    env.awsSecretAccessKey &&
    env.awsRegion &&
    env.awsBedrockModelId;

  await connectMongo(env.mongoUri);
  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${env.port}`);
    // eslint-disable-next-line no-console
    console.log(
      bedrockReady
        ? `LLM: AWS Bedrock (${env.awsBedrockModelId}) — falls back to OpenAI if Bedrock fails`
        : env.openAiApiKey
          ? `LLM: OpenAI (${env.openAiModel})`
          : "LLM synthesis disabled — set OPENAI_* or AWS Bedrock env vars"
    );
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
