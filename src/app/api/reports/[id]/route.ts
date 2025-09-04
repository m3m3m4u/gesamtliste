import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const COOKIE_NAME = 'site_auth';
const COOKIE_VALUE = process.env.SITE_AUTH_VERSION || '1';

async function ensureAuth(req: Request){
  const ok = (req.headers.get('cookie')||'').includes(`${COOKIE_NAME}=${COOKIE_VALUE}`);
  if(!ok) return false; return true;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }){
  if(!await ensureAuth(req)) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const id = params.id; if(!ObjectId.isValid(id)) return NextResponse.json({ error:'Bad id' },{ status:400 });
  const body = await req.json().catch(()=>({}));
  const status = body.status==='erledigt' ? 'erledigt' : body.status==='offen' ? 'offen' : undefined;
  if(!status) return NextResponse.json({ error:'Status ungültig' },{ status:400 });
  const client = await clientPromise; const db = client.db(); const col = db.collection('reports');
  await col.updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date().toISOString() } });
  return NextResponse.json({ ok:true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }){
  if(!await ensureAuth(req)) return NextResponse.json({ error:'Unauthorized' },{ status:401 });
  const id = params.id; if(!ObjectId.isValid(id)) return NextResponse.json({ error:'Bad id' },{ status:400 });
  const client = await clientPromise; const db = client.db(); const col = db.collection('reports');
  await col.deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ ok:true });
}