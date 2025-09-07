import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.MONGODB_URI) dotenv.config();
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI fehlt'); process.exit(1); }

// Optional: out=<Pfad> um in Datei zu schreiben
const args = Object.fromEntries(process.argv.slice(2).map(a=>{
  const i = a.indexOf('=');
  if (i === -1) return [a, true];
  return [a.slice(0,i), a.slice(i+1)];
}));
const outPath = args.out ? path.resolve(String(args.out)) : '';

function csvEscape(v){
  const s = v == null ? '' : String(v);
  // Semikolon als Trennzeichen -> Werte mit ; oder " oder Zeilenumbruch quoten
  if (/[";\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function run(){
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection('students');
    const filter = {
      $and: [
        { $or: [ { _deleted: { $exists: false } }, { _deleted: { $ne: true } } ] },
        { $or: [ { Benutzername: { $exists: false } }, { Benutzername: null }, { Benutzername: '' } ] },
        { 'Stufe 25/26': { $in: ['4','5','6','7','8', 4,5,6,7,8] } }
      ]
    };
    const proj = { projection: { Vorname: 1, Familienname: 1, 'Stufe 25/26': 1, 'Klasse 25/26': 1, '25/26': 1 } };
    const docs = await col.find(filter, proj).sort({ Familienname: 1, Vorname: 1 }).toArray();
    const rows = [];
    rows.push(['Familienname','Vorname','Klasse','Stufe'].join(';'));
    for (const d of docs) {
      const klasse = d['Klasse 25/26'] || d['25/26'] || '';
      const stufe = d['Stufe 25/26'] != null ? String(d['Stufe 25/26']) : '';
      rows.push([csvEscape(d.Familienname), csvEscape(d.Vorname), csvEscape(klasse), csvEscape(stufe)].join(';'));
    }
    const csv = rows.join('\r\n');
    if (outPath) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, csv, 'utf-8');
      console.log(`Geschrieben: ${outPath} (${docs.length} Zeilen + Header)`);
    } else {
      console.log(csv);
      console.log(`\nAnzahl: ${docs.length}`);
    }
  } finally {
    await client.close();
  }
}

run().catch(err=>{ console.error('Fehler:', err); process.exit(1); });
