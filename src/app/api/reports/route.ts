import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const COOKIE_NAME = 'site_auth';
const COOKIE_VALUE = process.env.SITE_AUTH_VERSION || '1';

export async function GET(req: Request){
  // Nur mit Auth (Cookie) erlauben
  const auth = (req.headers.get('cookie')||'').includes(`${COOKIE_NAME}=${COOKIE_VALUE}`);
  if(!auth) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const client = await clientPromise; const db = client.db(); const col = db.collection('reports');
  const items = await col.find({}, { projection:{ _id:1,text:1,status:1,createdAt:1,updatedAt:1 } }).sort({ createdAt:-1 }).limit(500).toArray();
  return NextResponse.json({ items });
}

export async function POST(req: Request){
  try {
    const body = await req.json().catch(()=>({}));
    const text = String(body.text||'').trim();
    if(!text) return NextResponse.json({ error:'Text fehlt' },{ status:400 });
    const client = await clientPromise; const db = client.db(); const col = db.collection('reports');
    const now = new Date().toISOString();
    const doc = { text, status:'offen', createdAt: now, updatedAt: now };
    const ins = await col.insertOne(doc as any);
    return NextResponse.json({ ok:true, id: ins.insertedId });
  } catch(e){
    return NextResponse.json({ error:'Fehler' },{ status:500 });
  }
}