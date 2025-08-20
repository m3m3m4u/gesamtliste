import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

function normStufe(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s || s === '-' || s === '—') return '0';
  return s;
}

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

export async function GET() {
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  const baseFilter = { _deleted: { $ne: true } };

  const rawStufen = await col.distinct('Stufe 25/26', baseFilter);
  const stufen = unique(rawStufen.map(normStufe))
    .filter(s => s !== '')
    .sort((a, b) => (a === '0' ? -1 : b === '0' ? 1 : Number(a) - Number(b)));

  const rawStatus = await col.distinct('Status', baseFilter);
  const status = unique(rawStatus.map(v => String(v ?? '').trim()))
    .filter(s => s !== '')
    .sort((a, b) => a.localeCompare(b, 'de'));

  const rawJahre = await col.distinct('Besuchsjahr', baseFilter);
  const jahre = unique(rawJahre.map(v => String(v ?? '').trim()))
    .filter(s => s !== '')
    .sort((a, b) => Number(a) - Number(b));

  const rawReligion = await col.distinct('Religion', baseFilter);
  const religionen = unique(rawReligion.map(v => String(v ?? '').trim()))
    .filter(s => s !== '')
    .sort((a, b) => a.localeCompare(b, 'de'));

  return NextResponse.json({ stufen, status, jahre, religionen });
}
