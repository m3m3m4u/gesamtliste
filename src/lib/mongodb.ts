import { MongoClient } from 'mongodb';

declare global {
  // Verhindert Mehrfachverbindungen im Dev-HMR; nicht in Prod nötig.
  var _mongoClientPromise: Promise<MongoClient> | undefined; // NOSONAR
}

const uri = process.env.MONGODB_URI;
const options = {
  // Kürzerer Timeout, damit Fehler schneller sichtbar werden
  serverSelectionTimeoutMS: Number(process.env.MONGO_SELECT_TIMEOUT_MS || 10000),
};

let client: MongoClient | undefined;

if (!process.env.MONGODB_URI) {
  throw new Error('Bitte MONGODB_URI in .env.local setzen');
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri!, options);
  const debug = process.env.DB_DEBUG === '1';
  const start = Date.now();
  global._mongoClientPromise = client.connect()
    .then(c => {
      if (debug) {
        // Erfolgsausgabe mit Dauer
        console.log('[MongoDB] verbunden in', Date.now() - start, 'ms', 'DB:', c.db().databaseName);
      }
      return c;
    })
    .catch(err => {
      if (debug) {
        console.error('[MongoDB] Verbindungsfehler:', err?.message);
        if (err?.name) console.error('Name:', err.name);
        if (err?.code) console.error('Code:', err.code);
        if (err?.stack) console.error(String(err.stack).split('\n').slice(0,6).join('\n'));
      }
      throw err;
    });
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
  _deleted?: boolean;
  deletedAt?: string;
  [key: string]: unknown; // dynamische weitere Felder
}
