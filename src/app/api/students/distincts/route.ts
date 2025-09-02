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
  type CfgDoc = { _id: string; angebote?: string[]; schwerpunkte?: string[]; fruehbetreuung?: string[]; status?: string[]; religionen?: string[]; klassen?: string[]; sprachen?: string[] };
  // Filter auf String-ID; mit as unknown als Workaround für ObjectId-Typkonflikt
  const cfg = await configCol.findOne<CfgDoc>({ _id: 'optionen' } as unknown as Record<string, unknown>).catch(()=>null);
  let angebote: string[];
  if (cfg && Array.isArray(cfg.angebote) && cfg.angebote.length) {
    angebote = unique(cfg.angebote.map(v=>String(v??'')).filter(s=>s.length>0));
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
  if (cfg && Array.isArray(cfg.schwerpunkte) && cfg.schwerpunkte.length) {
    schwerpunkte = unique(cfg.schwerpunkte.map(v=>String(v??'')).filter(s=>s.length>0));
  }

  let fruehbetreuung = unique((rawFrueh as unknown[]).map(v=>String(v??'').trim()))
    .filter(s=>s!=='')
    .sort((a,b)=>a.localeCompare(b,'de'));
  if (cfg && Array.isArray(cfg.fruehbetreuung) && cfg.fruehbetreuung.length) {
    fruehbetreuung = unique(cfg.fruehbetreuung.map(v=>String(v??'')).filter(s=>s.length>0));
  }

  if (cfg && Array.isArray(cfg.status) && cfg.status.length) {
    status = unique(cfg.status.map(v=>String(v??''))).filter(s=>s.length>0);
  }
  if (cfg && Array.isArray(cfg.religionen) && cfg.religionen.length) {
    religionen = unique(cfg.religionen.map(v=>String(v??'')).filter(s=>s.length>0));
  }
  if (cfg && Array.isArray(cfg.sprachen) && cfg.sprachen.length) {
    sprachen = unique(cfg.sprachen.map(v=>String(v??'')).filter(s=>s.length>0));
  }
  // Klassen (aus aktueller Klasse 25/26 oder historisch) aggregieren
  const rawKlassenNeu = await col.distinct('Klasse 25/26', baseFilter);
  const rawKlassenAlt1 = await col.distinct('Klasse 24/25', baseFilter).catch(()=>[]);
  let klassen = unique([...(rawKlassenNeu as unknown[]), ...(rawKlassenAlt1 as unknown[])].map(v=>String(v??'').trim()).filter(s=>s!==''));
  if (cfg && Array.isArray(cfg.klassen) && cfg.klassen.length) {
    klassen = unique(cfg.klassen.map(v=>String(v??''))).filter(s=>s.length>0);
  } else {
    klassen = klassen.sort((a,b)=>a.localeCompare(b,'de')); 
  }
  return NextResponse.json({ stufen, status, jahre, religionen, sprachen, angebote, schwerpunkte, fruehbetreuung, klassen });
}
