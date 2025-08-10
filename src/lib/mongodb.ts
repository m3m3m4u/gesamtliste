import { MongoClient } from 'mongodb';

declare global {
  // Verhindert Mehrfachverbindungen im Dev-HMR; nicht in Prod nötig.
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined; // NOSONAR
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  throw new Error('Bitte MONGODB_URI in .env.local setzen');
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri!, options);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export default clientPromise;
