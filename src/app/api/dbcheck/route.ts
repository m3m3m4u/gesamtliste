import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { MongoClient } from 'mongodb';

export const dynamic = 'force-dynamic';

function redact(uri: string | undefined) {
  if (!uri) return null;
  try {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@]+):([^@]+)@/i, (_, p, u) => `${p}${u}:***@`);
  } catch { return 'redact-failed'; }
}

function parseHosts(uri: string | undefined) {
  if (!uri) return [] as string[];
  const noProto = uri.replace(/^mongodb(?:\+srv)?:\/\//,'');
  const credsSplit = noProto.split('@');
  const hostPart = credsSplit.length > 1 ? credsSplit[1] : credsSplit[0];
  const firstSlash = hostPart.indexOf('/');
  const hosts = (firstSlash === -1 ? hostPart : hostPart.slice(0, firstSlash)).split(',');
  return hosts;
}

export async function GET() {
  const start = Date.now();
  const info: Record<string, unknown> = {
    node: process.version,
    hasMongoUri: !!process.env.MONGODB_URI,
    mongoUriRedacted: redact(process.env.MONGODB_URI),
    hosts: parseHosts(process.env.MONGODB_URI),
  };
  try {
    const client: MongoClient = await clientPromise;
    info.obtainClientMs = Date.now() - start;
    const db = client.db();
    info.db = db.databaseName;
    const pingStart = Date.now();
    const ping = await db.command({ ping: 1 });
    info.pingOk = ping.ok === 1;
    info.pingMs = Date.now() - pingStart;
    const colNames = await db.listCollections({}, { nameOnly: true }).toArray();
    info.collections = colNames.map(c => c.name).slice(0, 20);
    if (colNames.find(c => c.name === 'students')) {
      const students = db.collection('students');
      const est = await students.estimatedDocumentCount();
      info.studentsEstimated = est;
    }
  } catch (e: unknown) {
    let msg = 'unknown error';
    try { msg = (e as Error).message || String(e); } catch {}
    info.error = msg;
    // safe optional fields
    if (typeof e === 'object' && e !== null) {
      const ev = e as Record<string, unknown>;
      if (ev.code) info.code = ev.code;
      if (ev.name) info.name = ev.name;
      if (ev.stack) info.stackSnippet = String(ev.stack).split('\n').slice(0,3).join('\n');
    }
  }
  info.totalMs = Date.now() - start;
  return NextResponse.json(info, { status: info.error ? 500 : 200 });
}
