import dotenv from 'dotenv';
// Erst .env.local versuchen, dann .env
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

/*
 * Dieses Skript ersetzt die komplette students-Collection durch neue Werte.
 * Schritte:
 * 1. Liest JSON (Array) aus data/new_students.json (oder über CLI Pfad).
 * 2. Validiert Format.
 * 3. Löscht Collection-Inhalte.
 * 4. Legt notwendige Indizes neu an.
 * 5. Transformiert (Passwort-Hash, Normalisierung) und inserted alle Dokumente.
 * Sicherung: Optional kann vor dem Löschen ein Dump (JSON) in backups/ geschrieben werden.
 */
async function run(){
  const uri = process.env.MONGODB_URI;
  if(!uri){
    console.error('MONGODB_URI fehlt.');
    process.exit(1);
  }
  const fileArg = process.argv[2];
  const defaultFile = path.join(process.cwd(), 'data', 'new_students.json');
  const file = fileArg && fs.existsSync(fileArg) ? fileArg : defaultFile;
  if(!fs.existsSync(file)){
    console.error('Datei nicht gefunden:', file);
    process.exit(1);
  }
  console.log('Import-Datei:', file);
  let raw = fs.readFileSync(file,'utf-8');
  // NaN -> null
  raw = raw.replace(/\bNaN\b/g,'null');
  let docs: any;
  try { docs = JSON.parse(raw); } catch(e){
    console.error('JSON Parsing Fehler:', e);
    process.exit(1);
  }
  if(!Array.isArray(docs)){
    console.error('Datei muss ein Array enthalten.');
    process.exit(1);
  }
  if(docs.length===0){
    console.warn('Warnung: Array leer. Breche ab (nichts ersetzt).');
    return;
  }
  // Optionaler Backup
  const doBackup = process.env.REPLACE_BACKUP !== '0';
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection('students');
    if(doBackup){
      const all = await col.find({}).toArray();
      const backupDir = path.join(process.cwd(),'backups');
      fs.mkdirSync(backupDir,{recursive:true});
      const stamp = new Date().toISOString().replace(/[:.]/g,'-');
      const backupFile = path.join(backupDir, `students-backup-${stamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(all,null,2),'utf-8');
      console.log('Backup geschrieben:', backupFile, `(Einträge: ${all.length})`);
    }
    const countBefore = await col.countDocuments();
    if(countBefore>0){
      await col.deleteMany({});
      console.log('Alte Daten gelöscht:', countBefore);
    } else {
      console.log('Collection war bereits leer.');
    }
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const PLACEHOLDERS = new Set(['0','-','---','']);
    let inserted = 0;
    const bulk = col.initializeUnorderedBulkOp();
    const seen = new Set<string>();
    for(const d0 of docs){
      if(!d0 || typeof d0 !== 'object') continue;
      const d:any = { ...d0 };
      // Trim & Platzhalter
      for(const k of Object.keys(d)){
        if(typeof d[k] === 'string'){
          d[k] = d[k].trim();
          if(PLACEHOLDERS.has(d[k])) d[k] = null;
        }
      }
      if(!Array.isArray(d.Angebote)) d.Angebote = [];
      if(Array.isArray(d.Angebote)){
        d.Angebote = d.Angebote.filter((x:any)=>!(typeof x==='string' && PLACEHOLDERS.has(x.trim())));
      }
      if(d.Passwort && d.Passwort !== '0'){
        try {
          const pwd = String(d.Passwort);
            d.PasswortHash = bcrypt.hashSync(pwd, saltRounds);
        } catch(e){ console.warn('Passwort Hash Fehler:', e); }
      }
      // NormBenutzername
      if(d.Benutzername){
        const norm = String(d.Benutzername).trim().toLowerCase();
        if(!seen.has(norm)){
          d.NormBenutzername = norm; seen.add(norm);
        } else {
          console.warn('Duplikat Benutzername übersprungen:', d.Benutzername);
          continue;
        }
      }
      d.createdAt = new Date();
      d.updatedAt = new Date();
      bulk.insert(d);
      inserted++;
    }
    if(inserted===0){
      console.error('Nichts zum Einfügen (nach Filterung). Abbruch.');
      return;
    }
  const res = await bulk.execute();
  // In neueren MongoDB Treibern BulkWriteResult hat insertedCount
  // Fallback falls Feldname anders ist
  // @ts-ignore
  const insCount = (res.insertedCount != null ? res.insertedCount : (res as any).nInserted);
  console.log('Insert Result:', insCount);
    // Indizes neu anlegen
    await col.createIndex({ NormBenutzername: 1 }, { unique: true, partialFilterExpression: { NormBenutzername: { $type: 'string' } } }).catch(()=>{});
    await col.createIndex({ Benutzername: 1 }).catch(()=>{});
    console.log('Fertig. Neu eingefügte Einträge:', inserted);
  } finally {
    await client.close();
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
