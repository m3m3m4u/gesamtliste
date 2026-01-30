#!/usr/bin/env node
/**
 * Script zum Prüfen welche Angebote/Schwerpunkte in der DB sind
 * und ob sie schuljahresspezifisch gespeichert werden
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
  console.error('MONGODB_URI nicht gesetzt');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Mit MongoDB verbunden\n');

    const db = client.db();
    const col = db.collection('students');

    // Alle Felder finden die mit "Angebote" beginnen
    console.log('=== Suche nach Angebote-Feldern ===');
    const sampleDocs = await col.find({ _deleted: { $ne: true } }).limit(100).toArray();
    const angeboteFields = new Set();
    const schwerpunkteFields = new Set();
    
    for (const doc of sampleDocs) {
      for (const key of Object.keys(doc)) {
        if (key.toLowerCase().includes('angebot')) {
          angeboteFields.add(key);
        }
        if (key.toLowerCase().includes('schwerpunkt') || key.toLowerCase().includes('freifach')) {
          schwerpunkteFields.add(key);
        }
      }
    }
    
    console.log('Gefundene Angebote-Felder:', [...angeboteFields]);
    console.log('Gefundene Schwerpunkte/Freifach-Felder:', [...schwerpunkteFields]);
    
    // Schüler mit Angeboten finden
    console.log('\n=== Schüler mit nicht-leeren Angeboten ===');
    const mitAngeboten = await col.find({
      _deleted: { $ne: true },
      Angebote: { $exists: true, $ne: [] }
    }).limit(10).toArray();
    
    for (const s of mitAngeboten) {
      console.log(`${s.Vorname} ${s.Familienname}`);
      console.log(`  Klasse 24/25: ${s['Klasse 24/25'] || '-'}`);
      console.log(`  Klasse 25/26: ${s['Klasse 25/26'] || '-'}`);
      console.log(`  Klasse 26/27: ${s['Klasse 26/27'] || '-'}`);
      console.log(`  Stufe 24/25: ${s['Stufe 24/25'] || '-'}`);
      console.log(`  Stufe 25/26: ${s['Stufe 25/26'] || '-'}`);
      console.log(`  Stufe 26/27: ${s['Stufe 26/27'] || '-'}`);
      console.log(`  Angebote: ${JSON.stringify(s.Angebote)}`);
      console.log(`  Schwerpunkte: ${JSON.stringify(s.Schwerpunkte || s.Schwerpunkt || s['Schwerpunkt 1'])}`);
      console.log('');
    }
    
    // Schüler mit Schwerpunkten finden
    console.log('\n=== Schüler mit nicht-leeren Schwerpunkten ===');
    const mitSchwerpunkten = await col.find({
      _deleted: { $ne: true },
      $or: [
        { Schwerpunkte: { $exists: true, $ne: [], $ne: '' } },
        { Schwerpunkt: { $exists: true, $ne: [], $ne: '' } }
      ]
    }).limit(10).toArray();
    
    for (const s of mitSchwerpunkten) {
      console.log(`${s.Vorname} ${s.Familienname}`);
      console.log(`  Klasse 25/26: ${s['Klasse 25/26'] || '-'}`);
      console.log(`  Stufe 25/26: ${s['Stufe 25/26'] || '-'}`);
      console.log(`  Schwerpunkte: ${JSON.stringify(s.Schwerpunkte)}`);
      console.log(`  Schwerpunkt: ${JSON.stringify(s.Schwerpunkt)}`);
      console.log(`  Schwerpunkt 1: ${s['Schwerpunkt 1'] || '-'}`);
      console.log('');
    }
    
    // Alle einzigartigen Angebote-Werte sammeln
    console.log('\n=== Alle einzigartigen Angebote-Werte ===');
    const allDocs = await col.find({ 
      _deleted: { $ne: true }, 
      Angebote: { $exists: true, $ne: [] } 
    }).project({ Angebote: 1 }).toArray();
    
    const alleAngebote = new Set();
    for (const doc of allDocs) {
      if (Array.isArray(doc.Angebote)) {
        for (const a of doc.Angebote) {
          alleAngebote.add(a);
        }
      }
    }
    console.log([...alleAngebote].sort());
    
    // Prüfen auf 24/25 spezifische Felder
    console.log('\n=== Suche nach schuljahresspezifischen Angebote/Schwerpunkte Feldern ===');
    const allFields = new Set();
    const allDocsFull = await col.find({ _deleted: { $ne: true } }).limit(500).toArray();
    for (const doc of allDocsFull) {
      for (const key of Object.keys(doc)) {
        allFields.add(key);
      }
    }
    const relevantFields = [...allFields].filter(f => 
      f.toLowerCase().includes('angebot') || 
      f.toLowerCase().includes('schwerpunkt') ||
      f.toLowerCase().includes('freifach')
    );
    console.log('Relevante Felder:', relevantFields);
    
  } catch (error) {
    console.error('Fehler:', error);
  } finally {
    await client.close();
  }
}

main();
