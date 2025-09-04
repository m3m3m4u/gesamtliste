import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
// Embed-Einschränkung entfernt

// Single-Dokument-Konfiguration der erlaubten Listenwerte
// _id: 'optionen', Felder: { angebote: string[], schwerpunkte: string[], fruehbetreuung: string[] }

interface OptionenDoc { _id: string; angebote: string[]; schwerpunkte: string[]; fruehbetreuung: string[]; status?: string[]; religionen?: string[]; klassen?: string[]; sprachen?: string[]; updatedAt?: string }

async function loadDoc(){
  const client = await clientPromise; const db = client.db(); const col = db.collection<OptionenDoc>('config');
  const doc = await col.findOne({ _id: 'optionen' });
  return { col, doc };
}

export async function GET(){
  const { doc } = await loadDoc();
  const out: OptionenDoc = {
    angebote: Array.isArray(doc?.angebote) ? doc!.angebote : [],
    schwerpunkte: Array.isArray(doc?.schwerpunkte) ? doc!.schwerpunkte : [],
    fruehbetreuung: Array.isArray(doc?.fruehbetreuung) ? doc!.fruehbetreuung : [],
    status: Array.isArray(doc?.status) ? doc!.status : [],
    religionen: Array.isArray(doc?.religionen) ? doc!.religionen : [],
    klassen: Array.isArray(doc?.klassen) ? doc!.klassen : [],
    sprachen: Array.isArray(doc?.sprachen) ? doc!.sprachen : [],
    _id: 'optionen',
    updatedAt: doc?.updatedAt
  };
  // Einmalige Übernahme der Klassen falls leer
  if(!out.klassen || out.klassen.length===0){
    const client = await clientPromise; const db = client.db(); const students = db.collection('students');
    const baseFilter = { _deleted: { $ne: true } };
    const primary = await students.distinct('Klasse 25/26', baseFilter).catch(()=>[]);
    let list = Array.from(new Set((primary as unknown[]).map(v=>String(v??'').trim()).filter(s=>s.length>0)));
    if (list.length <= 1) {
      const altFields = ['Klasse','25/26','Klasse25','Klasse26','Klasse 24/25','Klasse 24/25_1'];
      for (const f of altFields) {
        try {
          const vals = await students.distinct(f, baseFilter);
          for (const v of vals as unknown[]) {
            const s = String(v??'').trim(); if(s) list.push(s);
          }
        } catch {}
      }
      list = Array.from(new Set(list));
      if (list.length <= 3) {
        try {
          const docs = await students.find(baseFilter, { projection: { _id: 0 } }).limit(5000).toArray();
          const pattern = /^[ABC][0-9]{2}$/i;
          for (const d of docs) {
            for (const v of Object.values(d)) {
              if (typeof v === 'string') {
                const s = v.trim(); if (pattern.test(s)) list.push(s);
              } else if (Array.isArray(v)) {
                for (const el of v) if (typeof el === 'string') { const s2 = el.trim(); if (pattern.test(s2)) list.push(s2); }
              }
            }
          }
          list = Array.from(new Set(list));
        } catch {}
      }
    }
    out.klassen = list.sort((a,b)=>a.localeCompare(b,'de'));
  }
  return NextResponse.json(out);
}

export async function PUT(request: Request){
  try {
    const body: Partial<OptionenDoc> = await request.json();
    const norm = (v: unknown): string[] => Array.isArray(v) ? v.map(x=>String(x)).filter(x=>x.length>0) : [];
    const doc = {
      _id: 'optionen',
      angebote: norm(body.angebote),
      schwerpunkte: norm(body.schwerpunkte),
      fruehbetreuung: norm(body.fruehbetreuung),
      status: norm(body.status),
      religionen: norm(body.religionen),
      klassen: norm(body.klassen),
      sprachen: norm(body.sprachen),
      updatedAt: new Date().toISOString()
    };
    const { col } = await loadDoc();
    await col.updateOne({ _id: 'optionen' }, { $set: doc }, { upsert: true });
    return NextResponse.json(doc);
  } catch(e){
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
