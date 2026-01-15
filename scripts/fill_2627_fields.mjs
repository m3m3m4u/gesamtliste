#!/usr/bin/env node
/**
 * Script: Felder für 26/27 befüllen
 * 
 * - Besuchsjahr 26/27: Besuchsjahr + 1
 * - Stufe 26/27: Stufe 25/26 + 1 (kann manuell geändert werden)
 * - Klasse 26/27: gleich wie Klasse 25/26 (kann manuell geändert werden)
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
  console.log('=== Felder für Schuljahr 26/27 befüllen ===');
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
        const name = `${student.Vorname || ''} ${student.Familienname || ''}`.trim() || student._id;
        
        // Besuchsjahr für 26/27 = Besuchsjahr + 1
        let besuchsjahr = student.Besuchsjahr;
        let besuchsjahr2627;
        if (besuchsjahr === undefined || besuchsjahr === null || besuchsjahr === '') {
          besuchsjahr2627 = 1;
        } else if (typeof besuchsjahr === 'number') {
          besuchsjahr2627 = besuchsjahr + 1;
        } else if (typeof besuchsjahr === 'string') {
          const parsed = parseInt(besuchsjahr, 10);
          besuchsjahr2627 = isNaN(parsed) ? 1 : parsed + 1;
        } else {
          besuchsjahr2627 = 1;
        }

        // Stufe 26/27 = Stufe 25/26 + 1
        let stufe2526 = student['Stufe 25/26'];
        let stufe2627;
        if (stufe2526 === undefined || stufe2526 === null || stufe2526 === '' || stufe2526 === '0') {
          stufe2627 = '1'; // Neue Erstklässler oder leere Stufe -> 1
        } else if (typeof stufe2526 === 'number') {
          stufe2627 = String(stufe2526 + 1);
        } else if (typeof stufe2526 === 'string') {
          const parsed = parseInt(stufe2526, 10);
          stufe2627 = isNaN(parsed) ? '1' : String(parsed + 1);
        } else {
          stufe2627 = '1';
        }

        // Klasse 26/27 = Klasse 25/26 (gleich)
        let klasse2526 = student['Klasse 25/26'] || '';
        let klasse2627 = klasse2526;

        const updateFields = {
          'Besuchsjahr 26/27': besuchsjahr2627,
          'Stufe 26/27': stufe2627,
          'Klasse 26/27': klasse2627
        };

        if (DRY_RUN) {
          console.log(`[DRY-RUN] ${name}:`);
          console.log(`  Besuchsjahr 26/27: ${besuchsjahr} → ${besuchsjahr2627}`);
          console.log(`  Stufe 26/27: ${stufe2526} → ${stufe2627}`);
          console.log(`  Klasse 26/27: ${klasse2526} → ${klasse2627}`);
          updated++;
        } else {
          await col.updateOne(
            { _id: student._id },
            { $set: updateFields }
          );
          updated++;
          if (updated <= 5) {
            console.log(`✓ ${name}:`);
            console.log(`  Besuchsjahr: ${besuchsjahr} → ${besuchsjahr2627}`);
            console.log(`  Stufe: ${stufe2526} → ${stufe2627}`);
            console.log(`  Klasse: ${klasse2526}`);
          } else if (updated === 6) {
            console.log('  ... (weitere Ausgaben unterdrückt)');
          }
        }
      } catch (err) {
        errors++;
        console.error(`✗ Fehler bei ${student._id}: ${err.message}`);
      }
    }

    console.log('\n=== Zusammenfassung ===');
    console.log(`Aktualisiert: ${updated}`);
    console.log(`Fehler: ${errors}`);

    if (DRY_RUN) {
      console.log('\n⚠️  DRY-RUN - Führe ohne --dry-run aus um Änderungen zu speichern');
    } else {
      console.log('\n✓ Fertig! Felder für 26/27 wurden befüllt.');
    }

  } catch (err) {
    console.error('Fehler:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
