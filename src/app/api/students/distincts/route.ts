import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
// Embed-Einschränkung entfernt

function normStufe(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s || s === '-' || s === '—') return '0';
  return s;
}

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }
const normalizeKey = (k: string) => k
  .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z]/g, '');
const isRelAnAbVariant = (k: string) => /^religi?onanab$/.test(normalizeKey(k));
const normalizeRelAnAbValue = (v: unknown): '' | 'an' | 'ab' => {
  if (typeof v !== 'string') return '';
  const g = v.trim().toLowerCase();
  return g === 'an' ? 'an' : g === 'ab' ? 'ab' : '';
};

export async function GET() {
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  const baseFilter = { _deleted: { $ne: true } };

  const rawStufen = await col.distinct('Stufe 25/26', baseFilter);
  let stufen = unique(rawStufen.map(normStufe))
    .filter(s => s !== '')
    .sort((a, b) => (a === '0' ? -1 : b === '0' ? 1 : Number(a) - Number(b)));
  // Spezialfall: Einträge '25/26' und '24/25' sollen als Klassen behandelt werden, nicht als Stufen
  const klassenAusStufen: string[] = [];
  for (const spec of ['25/26','24/25']) {
    if (stufen.includes(spec)) {
      stufen = stufen.filter(s => s !== spec);
      klassenAusStufen.push(spec);
    }
  }

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
  const relAnAbValues: string[] = [];
  try {
    const rawRelAnAb = await col.distinct('Religion an/ab', baseFilter);
    for (const item of rawRelAnAb as unknown[]) {
      const norm = normalizeRelAnAbValue(item);
      if (norm) relAnAbValues.push(norm);
    }
  } catch {}
  try {
    const probeDocs = await col.find(baseFilter, { projection: { _id: 0 } }).limit(2000).toArray();
    for (const doc of probeDocs) {
      for (const [key, value] of Object.entries(doc)) {
        if (isRelAnAbVariant(key)) {
          const norm = normalizeRelAnAbValue(value);
          if (norm) relAnAbValues.push(norm);
        }
      }
    }
  } catch {}
  const religionAnAb = unique(relAnAbValues).sort((a, b) => a.localeCompare(b));
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
  // 'Schwerpunkt 1' wird bewusst ignoriert (Legacy)
  const rawFrueh = await col.distinct('Frühbetreuung', baseFilter);
  const splitter = /[,;/\n\r\t]+/;
  const collect: string[] = [];
  for (const src of [rawSchwerpunkteFeld, rawSchwerpunkt]) {
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
    status = unique([
      ...status,
      ...cfg.status.map(v=>String(v??'').trim()).filter(s=>s.length>0)
    ]).sort((a,b)=>a.localeCompare(b,'de'));
  }
  if (cfg && Array.isArray(cfg.religionen) && cfg.religionen.length) {
    religionen = unique([
      ...religionen,
      ...cfg.religionen.map(v=>String(v??'').trim()).filter(s=>s.length>0)
    ]).sort((a,b)=>a.localeCompare(b,'de'));
  }
  if (cfg && Array.isArray(cfg.sprachen) && cfg.sprachen.length) {
    sprachen = unique([
      ...sprachen,
      ...cfg.sprachen.map(v=>String(v??'').trim()).filter(s=>s.length>0)
    ]).sort((a,b)=>a.localeCompare(b,'de'));
  }
  // Klassen (primär aus kanonischem Feld '25/26', danach aus 'Klasse 25/26') aggregieren
  const rawKlassenPrim = await col.distinct('25/26', baseFilter);
  const rawKlassenSek = await col.distinct('Klasse 25/26', baseFilter);
  let klassen = unique([
    ...(rawKlassenPrim as unknown[]).map(v=>String(v??'').trim()),
    ...(rawKlassenSek as unknown[]).map(v=>String(v??'').trim())
  ].filter(s=>s!==''));
  // Fallback: Wenn zu wenige Klassen (<=1), ergänze aus Legacy-/Alternativfeldern
  if (klassen.length <= 1) {
    const altFields = [
      'Klasse', '25/26', 'Klasse25', 'Klasse26', 'Klasse 24/25', 'Klasse 24/25_1'
    ];
    const extra: string[] = [];
    for (const f of altFields) {
      try {
        const vals = await col.distinct(f, baseFilter);
        for (const v of vals as unknown[]) {
          const s = String(v ?? '').trim();
            if (s) extra.push(s);
        }
      } catch {}
    }
    klassen = unique([...klassen, ...extra]);
    // Zusätzlicher Heuristik-Scan: Falls weiterhin sehr wenige Klassen (<=3), alle Dokumente parsen
    if (klassen.length <= 3) {
      try {
        const docs = await col.find(baseFilter, { projection: { _id: 0 } }).limit(5000).toArray();
        const pattern = /^[ABC][0-9]{2}$/i; // A01, B22, C13 usw.
        for (const d of docs) {
        for (const value of Object.values(d)) {
            if (value == null) continue;
            if (typeof value === 'string') {
              const s = value.trim();
              if (pattern.test(s)) klassen.push(s);
            } else if (Array.isArray(value)) {
              for (const el of value) {
                if (typeof el === 'string') {
                  const s2 = el.trim();
                  if (pattern.test(s2)) klassen.push(s2);
                }
              }
            }
          }
        }
        klassen = unique(klassen);
      } catch {}
    }
  }
  // Aus den Stufen ausgekoppelte Klassen ergänzen
  for (const kVal of klassenAusStufen) {
    if (!klassen.includes(kVal)) klassen.push(kVal);
  }
  if (cfg && Array.isArray(cfg.klassen) && cfg.klassen.length) {
    klassen = unique([
      ...klassen,
      ...cfg.klassen.map(v=>String(v??'').trim()).filter(s=>s.length>0)
    ]).filter(s=>s.length>0).sort((a,b)=>a.localeCompare(b,'de'));
  } else {
    klassen = klassen.sort((a,b)=>a.localeCompare(b,'de'));
  }
  // Notfall: falls nach allem leer, nimm direkt rohe Werte (erst Primär-, dann Sek-Feld)
  if(!klassen.length){
    if (Array.isArray(rawKlassenPrim)) {
      klassen = unique((rawKlassenPrim as unknown[]).map(v=>String(v??'').trim()).filter(s=>s.length>0));
    }
    if(!klassen.length && Array.isArray(rawKlassenSek)){
      klassen = unique((rawKlassenSek as unknown[]).map(v=>String(v??'').trim()).filter(s=>s.length>0));
    }
  }
  klassen = klassen.sort((a,b)=>a.localeCompare(b,'de'));
  return NextResponse.json({ stufen, status, jahre, religionen, religionAnAb, sprachen, angebote, schwerpunkte, fruehbetreuung, klassen });
}
