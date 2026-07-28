import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "folk_attendance";

declare global {
  // eslint-disable-next-line no-var
  var __folkMongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise = global.__folkMongoClientPromise;

if (!clientPromise) {
  if (uri) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
    global.__folkMongoClientPromise = clientPromise;
  }
}

export async function getMongoClient() {
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
    global.__folkMongoClientPromise = clientPromise;
  }

  return clientPromise as Promise<MongoClient>;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}
