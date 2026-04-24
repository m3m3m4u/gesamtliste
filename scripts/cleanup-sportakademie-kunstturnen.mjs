#!/usr/bin/env node
/**
 * Entfernt alle Vorkommen von "Kunstturnen" und "Sportakademie Kunstturnen" 
 * aus der Datenbank (students und config collections).
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI nicht gefunden in .env.local');
  process.exit(1);
}

// Verbotene Begriffe
const FORBIDDEN_TERMS = ['kunstturnen', 'sportakademie kunstturnen'];

function isForbidden(term) {
  const lower = String(term || '').toLowerCase().trim();
  return FORBIDDEN_TERMS.some(f => lower === f || lower.includes('kunstturnen'));
}

function normalizeList(val) {
  if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
  if (val == null) return [];
  const s = String(val).trim();
  if (!s) return [];
  return s.split(/[,;/\n\r\t+&|]+/).map(x => x.trim()).filter(Boolean);
}

function rebuild(original, filtered) {
  if (Array.isArray(original)) return filtered;
  return filtered.join(', ');
}

async function main() {
  console.log('Verbinde mit MongoDB...');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  // 1. Students Collection bereinigen
  console.log('\n=== Students Collection ===');
  const studentsCol = db.collection('students');
  const TARGET_FIELDS = ['Angebote', 'Schwerpunkte', 'Schwerpunkt'];
  const regex = /kunstturnen/i;
  
  const query = {
    $or: TARGET_FIELDS.map(f => ({ [f]: { $regex: regex } }))
  };

  const cursor = studentsCol.find(query, { 
    projection: { _id: 1, Vorname: 1, Familienname: 1, Angebote: 1, Schwerpunkte: 1, Schwerpunkt: 1 } 
  });
  
  let modified = 0;
  const bulk = [];
  
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    
    const update = {};
    let changed = false;
    
    for (const field of TARGET_FIELDS) {
      const original = doc[field];
      if (original === undefined) continue;
      
      const list = normalizeList(original);
      const filtered = list.filter(x => !isForbidden(x));
      
      if (filtered.length !== list.length) {
        const rebuilt = rebuild(original, filtered);
        if (Array.isArray(rebuilt) && rebuilt.length === 0) {
          update[field] = [];
        } else if (typeof rebuilt === 'string') {
          const trimmed = rebuilt.trim()
            .replace(/^[,;/+&|\s]+/, '')
            .replace(/[,;/+&|\s]+$/, '')
            .replace(/\s{2,}/g, ' ');
          update[field] = trimmed || [];
        } else {
          update[field] = rebuilt;
        }
        changed = true;
        console.log(`  ${doc.Vorname} ${doc.Familienname}: ${field} bereinigt`);
      }
    }
    
    if (changed) {
      bulk.push({ updateOne: { filter: { _id: doc._id }, update: { $set: update } } });
      modified++;
    }
  }
  
  if (bulk.length > 0) {
    await studentsCol.bulkWrite(bulk);
  }
  console.log(`\n${modified} Schüler bereinigt.`);

  // 2. Config/Options Collection bereinigen
  console.log('\n=== Config Collection (Optionen) ===');
  const configCol = db.collection('config');
  const optDoc = await configCol.findOne({ _id: 'optionen' });
  
  let optionsModified = false;
  if (optDoc) {
    const updates = {};
    for (const listField of ['angebote', 'schwerpunkte']) {
      const arr = optDoc[listField];
      if (Array.isArray(arr)) {
        const before = arr.length;
        const filtered = arr.filter(x => !isForbidden(String(x || '')));
        if (filtered.length !== before) {
          updates[listField] = filtered;
          optionsModified = true;
          const removed = arr.filter(x => isForbidden(String(x || '')));
          console.log(`  ${listField}: Entfernt: ${removed.join(', ')}`);
        }
      }
    }
    
    if (optionsModified) {
      await configCol.updateOne({ _id: 'optionen' }, { $set: updates });
      console.log('Optionen aktualisiert.');
    } else {
      console.log('Keine verbotenen Begriffe in Optionen gefunden.');
    }
  } else {
    console.log('Keine Optionen-Dokument gefunden.');
  }

  await client.close();
  console.log('\n✓ Fertig! "Sportakademie Kunstturnen" und "Kunstturnen" wurden entfernt.');
}

main().catch(err => {
  console.error('Fehler:', err);
  process.exit(1);
});
