import mongoose from "mongoose";


type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cache = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cache;

export async function connectDB() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("Missing MONGODB_URI environment variable");
    cache.promise = mongoose.connect(uri, { bufferCommands: false }).catch((error) => {
      cache.promise = null;
      throw error;
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
