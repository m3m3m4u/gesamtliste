import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(){
  try {
    const client = await clientPromise; const db = client.db(); const col = db.collection('students');
    const baseFilter = { _deleted: { $ne: true } } as Record<string, unknown>;
    const splitter = /[,;/\n\r\t]+/;
    const cursor = col.find({ ...baseFilter, 'Schwerpunkt 1': { $exists: true } }, { projection: { _id: 1, Schwerpunkte: 1, 'Schwerpunkt 1': 1 } });
    let touched = 0;
    const bulk = col.initializeUnorderedBulkOp();
    while (await cursor.hasNext()) {
      const doc = await cursor.next(); if(!doc) break;
      const any = doc as Record<string, unknown>;
      const s1 = any['Schwerpunkt 1'];
      // Sammle Zielwerte
      const set = new Set<string>();
      const addVal = (v: unknown) => { const s = String(v ?? '').trim(); if(s && s !== '-' && s !== '—') set.add(s); };
      if (Array.isArray(any['Schwerpunkte'])) for (const v of any['Schwerpunkte'] as unknown[]) addVal(v);
      if (Array.isArray(s1)) { for (const v of s1 as unknown[]) addVal(v); }
      else if (typeof s1 === 'string') {
        const s = s1.trim();
        if (s) {
          if (splitter.test(s)) { for (const part of s.split(splitter)) addVal(part); }
          else addVal(s);
        }
      }
      const nextArr = Array.from(set);
      bulk.find({ _id: (any as { _id: unknown })._id }).updateOne({ $set: { Schwerpunkte: nextArr }, $unset: { 'Schwerpunkt 1': '' } });
      touched++;
    }
    if (touched) await bulk.execute();
    return NextResponse.json({ ok: true, updatedDocs: touched });
  } catch(e){
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
