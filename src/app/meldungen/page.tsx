import React from 'react';
import Link from 'next/link';
import clientPromise from '@/lib/mongodb';
import MeldungenClient from './MeldungenClient';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function MeldungenPage(){
  const cookieStore = await cookies();
  const version = process.env.SITE_AUTH_VERSION || '1';
  const authed = cookieStore.get('site_auth')?.value === version;
  if(!authed){
    return <div className="p-8 text-center text-sm">Nicht autorisiert.</div>;
  }
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('reports');
  const items = await col.find({}, { projection: { _id:1, text:1, status:1, createdAt:1, updatedAt:1 } }).sort({ createdAt:-1 }).limit(500).toArray();
  const mapped = items.map(d=>({
    _id: String(d._id),
    text: String(d.text||''),
    status: (d.status==='erledigt'?'erledigt':'offen') as 'offen'|'erledigt',
    createdAt: d.createdAt || '',
    updatedAt: d.updatedAt || ''
  }));
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Meldungen</h1>
        <Link href="/" className="text-sm text-blue-600 underline">Zurück</Link>
      </div>
      <MeldungenClient initialItems={mapped} />
    </div>
  );
}