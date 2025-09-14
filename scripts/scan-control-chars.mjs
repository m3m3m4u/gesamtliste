#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if(!process.env.MONGODB_URI) dotenv.config();
import { MongoClient } from 'mongodb';

/*
  Sucht nach Steuerzeichen (ASCII < 0x20 oder 0x7F) in Vorname / Familienname / Nachname
  und gibt eine Tabelle sowie eine Exportdatei (optional) aus.

  Aufruf:
    node scripts/scan-control-chars.mjs [out=pfad]
*/

const args = Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return i===-1?[a,true]:[a.slice(0,i),a.slice(i+1)];}));
const out = args.out ? String(args.out) : '';

function visualize(str=''){
  return [...str].map(ch=>{
    const code = ch.codePointAt(0);
    if(code==null) return '';
    if(code < 32 || code === 127) return `<${code.toString(16).padStart(2,'0')}>`;
    return ch;
  }).join('');
}

(async()=>{
  const uri = process.env.MONGODB_URI; if(!uri){console.error('MONGODB_URI fehlt');process.exit(1);} 
  const client = new MongoClient(uri); await client.connect();
  try {
    const col = client.db().collection('students');
    // RegExp für Steuerzeichen
    const ctrl = /[\x00-\x1F\x7F]/;
    const cursor = col.find({ $or: [ { Vorname: ctrl }, { Familienname: ctrl }, { Nachname: ctrl } ] }, { projection: { Vorname:1,Familienname:1,Nachname:1 } });
    const rows = [];
    while (await cursor.hasNext()){
      const d = await cursor.next();
      rows.push({ id: d._id.toString(), Vorname: d.Vorname||'', Familienname: d.Familienname||d.Nachname||'', Nachname: d.Nachname||'', visV: visualize(d.Vorname||''), visF: visualize(d.Familienname||d.Nachname||'') });
    }
    if(!rows.length){ console.log('Keine Steuerzeichen gefunden.'); return; }
    console.log('Gefundene Datensätze:', rows.length);
    for(const r of rows.slice(0,50)){
      console.log('-', r.id, '| V:', r.visV, '| F:', r.visF);
    }
    if (out){
      const fs = await import('fs');
      const header = 'id;Vorname;Familienname;Vorname_vis;Familienname_vis';
      const csv = [header, ...rows.map(r=>[r.id,r.Vorname,r.Familienname,r.visV,r.visF].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';'))].join('\n');
      fs.writeFileSync(out, csv, 'utf-8');
      console.log('Export geschrieben:', out);
    }
  } finally { await client.close(); }
})();
