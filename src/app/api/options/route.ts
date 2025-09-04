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
    const rawKl = await students.distinct('Klasse 25/26', { _deleted: { $ne: true } });
    out.klassen = Array.from(new Set((rawKl as unknown[]).map(v=>String(v??'').trim()).filter(s=>s.length>0))).sort((a,b)=>a.localeCompare(b,'de'));
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
