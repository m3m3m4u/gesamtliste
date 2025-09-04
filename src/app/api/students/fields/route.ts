import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Liefert eine alphabetisch sortierte Liste aller Feldnamen (Schlüssel) der Studenten-Dokumente.
// GET /api/students/fields
export async function GET(){
  try {
    const client = await clientPromise; const db = client.db(); const col = db.collection('students');
    const pipeline = [
      { $match: { } },
      { $project: { arr: { $objectToArray: '$$ROOT' } } },
      { $unwind: '$arr' },
      { $group: { _id: null, keys: { $addToSet: '$arr.k' } } }
    ];
    const agg = await col.aggregate<{ keys: string[] }>(pipeline).toArray();
    const keys = agg.length ? agg[0].keys.filter(k=>!k.startsWith('_id')).sort((a,b)=>a.localeCompare(b,'de')) : [];
    return NextResponse.json({ keys });
  } catch(e){
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}