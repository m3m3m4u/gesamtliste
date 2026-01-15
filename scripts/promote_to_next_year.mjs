#!/usr/bin/env node
/**
 * Script: Schüler ins nächste Schuljahr übernehmen (25/26 → 26/27)
 * 
 * Regeln:
 * - Statische Felder bleiben gleich (Vorname, Familienname, Geburtsdatum, 
 *   Benutzername, Passwort, Anton, SokratesID, Familien ID, Religion, Muttersprache)
 * - Schuljahr 25/26 Daten bleiben unverändert
 * - Neue Felder für 26/27:
 *   - "Stufe 26/27" = "" (leer)
 *   - "Klasse 26/27" = "" (leer)
 * - Besuchsjahr wird um 1 erhöht
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env.local laden
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI nicht gefunden in .env.local');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('=== Schüler ins Schuljahr 26/27 übernehmen ===');
  if (DRY_RUN) {
    console.log('⚠️  DRY-RUN Modus - keine Änderungen werden gespeichert\n');
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✓ Mit MongoDB verbunden\n');

    const db = client.db();
    const col = db.collection('students');

    // Alle aktiven Schüler holen (nicht gelöscht)
    const students = await col.find({ _deleted: { $ne: true } }).toArray();
    console.log(`Gefunden: ${students.length} aktive Schüler\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const student of students) {
      try {
        // Prüfen ob bereits Felder für 26/27 existieren
        const has2627 = student['Stufe 26/27'] !== undefined || student['Klasse 26/27'] !== undefined;
        
        // Besuchsjahr ermitteln und um 1 erhöhen
        let currentBesuchsjahr = student.Besuchsjahr;
        let newBesuchsjahr;
        
        if (currentBesuchsjahr === undefined || currentBesuchsjahr === null || currentBesuchsjahr === '') {
          newBesuchsjahr = 1; // Default wenn nicht vorhanden
        } else if (typeof currentBesuchsjahr === 'string') {
          const parsed = parseInt(currentBesuchsjahr, 10);
          newBesuchsjahr = isNaN(parsed) ? 1 : parsed + 1;
        } else if (typeof currentBesuchsjahr === 'number') {
          newBesuchsjahr = currentBesuchsjahr + 1;
        } else {
          newBesuchsjahr = 1;
        }

        // Update-Objekt erstellen
        const updateFields = {
          'Stufe 26/27': '',
          'Klasse 26/27': '',
          'Besuchsjahr': newBesuchsjahr
        };

        const name = `${student.Vorname || ''} ${student.Familienname || ''}`.trim() || student._id;

        if (DRY_RUN) {
          console.log(`[DRY-RUN] ${name}: Besuchsjahr ${currentBesuchsjahr} → ${newBesuchsjahr}, Stufe/Klasse 26/27 = leer`);
          updated++;
        } else {
          const result = await col.updateOne(
            { _id: student._id },
            { $set: updateFields }
          );

          if (result.modifiedCount > 0 || result.matchedCount > 0) {
            updated++;
            if (updated <= 10) {
              console.log(`✓ ${name}: Besuchsjahr ${currentBesuchsjahr} → ${newBesuchsjahr}`);
            } else if (updated === 11) {
              console.log('  ... (weitere Ausgaben unterdrückt)');
            }
          } else {
            skipped++;
          }
        }
      } catch (err) {
        errors++;
        console.error(`✗ Fehler bei ${student._id}: ${err.message}`);
      }
    }

    console.log('\n=== Zusammenfassung ===');
    console.log(`Aktualisiert: ${updated}`);
    console.log(`Übersprungen: ${skipped}`);
    console.log(`Fehler: ${errors}`);

    if (DRY_RUN) {
      console.log('\n⚠️  DRY-RUN - Führe ohne --dry-run aus um Änderungen zu speichern');
    } else {
      console.log('\n✓ Fertig! Alle Schüler wurden ins Schuljahr 26/27 übernommen.');
    }

  } catch (err) {
    console.error('Fehler:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
