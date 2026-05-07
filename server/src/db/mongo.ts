import mongoose from "mongoose";

let mongoPromise: Promise<typeof mongoose> | undefined;

export async function connectMongo(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (!mongoPromise) {
    mongoPromise = mongoose.connect(uri).catch((error) => {
      mongoPromise = undefined;
      if (error instanceof Error && error.name === "MongooseServerSelectionError") {
        // eslint-disable-next-line no-console
        console.error(
          "[mongo] Atlas: Network Access must allow this host’s outbound IP (Render free tier: use 0.0.0.0/0 to verify, then tighten). See https://www.mongodb.com/docs/atlas/security/ip-access-list/"
        );
      }
      throw error;
    });
  }
  await mongoPromise;
}
