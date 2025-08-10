import { MongoClient } from 'mongodb';

declare global {
  // Verhindert Mehrfachverbindungen im Dev-HMR; nicht in Prod nötig.
  var _mongoClientPromise: Promise<MongoClient> | undefined; // NOSONAR
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient | undefined;

if (!process.env.MONGODB_URI) {
  throw new Error('Bitte MONGODB_URI in .env.local setzen');
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri!, options);
  global._mongoClientPromise = client.connect();
}
const clientPromiseExport = global._mongoClientPromise; // wird nicht neu zugewiesen
export default clientPromiseExport;

// Gemeinsamer Student Typ (flexibel, aber ohne any)
export interface StudentDoc {
  _id?: string;
  Vorname?: string;
  Familienname?: string;
  Nachname?: string;
  Benutzername?: string;
  Geburtsdatum?: string; // ISO oder DD.MM.YYYY
  Passwort?: string;
  PasswortHash?: string;
  Angebote?: string[];
  Schwerpunkte?: string[] | string;
  Schwerpunkt?: string[] | string;
  'Schwerpunkt 1'?: string;
  [key: string]: unknown; // dynamische weitere Felder
}
