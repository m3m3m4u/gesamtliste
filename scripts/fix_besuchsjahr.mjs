#!/usr/bin/env node
/**
 * Script: Besuchsjahr-Korrektur - wieder um 1 verringern
 * 
 * Das Besuchsjahr wurde fälschlicherweise erhöht, muss aber für 25/26 gleich bleiben.
 * Für 26/27 wird es in der Anzeige dynamisch +1 berechnet.
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI nicht gefunden in .env.local');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('=== Besuchsjahr-Korrektur: wieder um 1 verringern ===');
  if (DRY_RUN) {
    console.log('⚠️  DRY-RUN Modus - keine Änderungen werden gespeichert\n');
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✓ Mit MongoDB verbunden\n');

    const db = client.db();
    const col = db.collection('students');

    // Alle aktiven Schüler holen
    const students = await col.find({ _deleted: { $ne: true } }).toArray();
    console.log(`Gefunden: ${students.length} aktive Schüler\n`);

    let updated = 0;
    let errors = 0;

    for (const student of students) {
      try {
        let currentBesuchsjahr = student.Besuchsjahr;
        let newBesuchsjahr;
        
        if (currentBesuchsjahr === undefined || currentBesuchsjahr === null || currentBesuchsjahr === '') {
          // Nichts zu tun
          continue;
        } else if (typeof currentBesuchsjahr === 'number') {
          newBesuchsjahr = Math.max(0, currentBesuchsjahr - 1);
        } else if (typeof currentBesuchsjahr === 'string') {
          const parsed = parseInt(currentBesuchsjahr, 10);
          if (isNaN(parsed)) continue;
          newBesuchsjahr = Math.max(0, parsed - 1);
        } else {
          continue;
        }

        const name = `${student.Vorname || ''} ${student.Familienname || ''}`.trim() || student._id;

        if (DRY_RUN) {
          console.log(`[DRY-RUN] ${name}: Besuchsjahr ${currentBesuchsjahr} → ${newBesuchsjahr}`);
          updated++;
        } else {
          await col.updateOne(
            { _id: student._id },
            { $set: { Besuchsjahr: newBesuchsjahr } }
          );
          updated++;
          if (updated <= 10) {
            console.log(`✓ ${name}: Besuchsjahr ${currentBesuchsjahr} → ${newBesuchsjahr}`);
          } else if (updated === 11) {
            console.log('  ... (weitere Ausgaben unterdrückt)');
          }
        }
      } catch (err) {
        errors++;
        console.error(`✗ Fehler bei ${student._id}: ${err.message}`);
      }
    }

    console.log('\n=== Zusammenfassung ===');
    console.log(`Korrigiert: ${updated}`);
    console.log(`Fehler: ${errors}`);

    if (DRY_RUN) {
      console.log('\n⚠️  DRY-RUN - Führe ohne --dry-run aus um Änderungen zu speichern');
    } else {
      console.log('\n✓ Fertig! Besuchsjahr wurde korrigiert.');
    }

  } catch (err) {
    console.error('Fehler:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
