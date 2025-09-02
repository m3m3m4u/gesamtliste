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
  let status = unique(rawStatus.map(v => String(v ?? '').trim()))
    .filter(s => s !== '')
    .sort((a, b) => a.localeCompare(b, 'de'));

  const rawJahre = await col.distinct('Besuchsjahr', baseFilter);
  const jahre = unique(rawJahre.map(v => String(v ?? '').trim()))
    .filter(s => s !== '')
    .sort((a, b) => Number(a) - Number(b));

  const rawReligion = await col.distinct('Religion', baseFilter);
  let religionen = unique(rawReligion.map(v => String(v ?? '').trim()))
    .filter(s => s !== '')
    .sort((a, b) => a.localeCompare(b, 'de'));
  const rawSprachen = await col.distinct('Muttersprache', baseFilter);
  let sprachen = unique(rawSprachen.map(v=>String(v??'').trim())).filter(s=>s!=='').sort((a,b)=>a.localeCompare(b,'de'));

  // Konfigurationsdokument lesen (falls vorhanden)
  const configCol = db.collection('config');
  const cfg = await configCol.findOne({ _id: 'optionen' } as any).catch(()=>null);
  let angebote: string[];
  if (cfg && Array.isArray((cfg as any).angebote) && (cfg as any).angebote.length) {
  angebote = unique((cfg as any).angebote.map((v: any)=>String(v??'')).filter((s: string)=>s.length>0));
  } else {
    const rawAngebote = await col.distinct('Angebote', baseFilter);
    angebote = unique(rawAngebote.map(v => String(v ?? '').trim()))
      .filter(s => s !== '')
      .sort((a, b) => a.localeCompare(b, 'de'));
  }

  // Schwerpunkte können in verschiedenen Feldern / Formaten liegen
  const rawSchwerpunkteFeld = await col.distinct('Schwerpunkte', baseFilter);
  const rawSchwerpunkt = await col.distinct('Schwerpunkt', baseFilter);
  const rawSchwerpunkt1 = await col.distinct('Schwerpunkt 1', baseFilter).catch(()=>[]);
  const rawFrueh = await col.distinct('Frühbetreuung', baseFilter);
  const splitter = /[,;/\n\r\t]+/;
  const collect: string[] = [];
  for (const src of [rawSchwerpunkteFeld, rawSchwerpunkt, rawSchwerpunkt1]) {
    for (const item of src as unknown[]) {
      if (item == null) continue;
      if (Array.isArray(item)) {
        for (const el of item) if (el != null) collect.push(String(el).trim());
      } else {
        const s = String(item).trim();
        if (!s) continue;
        // Falls mehrere durch Separatoren kombiniert
        if (splitter.test(s)) {
          s.split(splitter).map(x=>x.trim()).filter(Boolean).forEach(x=>collect.push(x));
        } else collect.push(s);
      }
    }
  }
  let schwerpunkte = unique(collect.map(v=>v.trim()))
    .filter(s=>s!=='' && s !== '-')
    .sort((a,b)=>a.localeCompare(b,'de'));
  if (cfg && Array.isArray((cfg as any).schwerpunkte) && (cfg as any).schwerpunkte.length) {
  schwerpunkte = unique((cfg as any).schwerpunkte.map((v: any)=>String(v??'')).filter((s: string)=>s.length>0));
  }

  let fruehbetreuung = unique((rawFrueh as unknown[]).map(v=>String(v??'').trim()))
    .filter(s=>s!=='')
    .sort((a,b)=>a.localeCompare(b,'de'));
  if (cfg && Array.isArray((cfg as any).fruehbetreuung) && (cfg as any).fruehbetreuung.length) {
  fruehbetreuung = unique((cfg as any).fruehbetreuung.map((v: any)=>String(v??'')).filter((s: string)=>s.length>0));
  }

  if (cfg && Array.isArray((cfg as any).status) && (cfg as any).status.length) {
    status = unique(((cfg as any).status as any[]).map((v: any)=>String(v??''))).filter((s: string)=> (s as string).length>0) as string[];
  }
  if (cfg && Array.isArray((cfg as any).religionen) && (cfg as any).religionen.length) {
    religionen = unique((cfg as any).religionen.map((v: any)=>String(v??'')).filter((s: string)=>s.length>0));
  }
  if (cfg && Array.isArray((cfg as any).sprachen) && (cfg as any).sprachen.length) {
    sprachen = unique((cfg as any).sprachen.map((v: any)=>String(v??'')).filter((s: any)=>(s as string).length>0)) as string[];
  }
  // Klassen (aus aktueller Klasse 25/26 oder historisch) aggregieren
  const rawKlassenNeu = await col.distinct('Klasse 25/26', baseFilter);
  const rawKlassenAlt1 = await col.distinct('Klasse 24/25', baseFilter).catch(()=>[]);
  let klassen = unique([...(rawKlassenNeu as unknown[]), ...(rawKlassenAlt1 as unknown[])].map(v=>String(v??'').trim()).filter(s=>s!==''));
  if (cfg && Array.isArray((cfg as any).klassen) && (cfg as any).klassen.length) {
  klassen = unique((cfg as any).klassen.map((v: any)=>String(v??''))).filter((s: any)=>(s as string).length>0) as string[];
  } else {
    klassen = klassen.sort((a,b)=>a.localeCompare(b,'de')); 
  }
  return NextResponse.json({ stufen, status, jahre, religionen, sprachen, angebote, schwerpunkte, fruehbetreuung, klassen });
}
