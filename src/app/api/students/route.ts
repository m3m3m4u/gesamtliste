import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import type { Document, ObjectId, AnyBulkWriteOperation } from 'mongodb';
// Embed-Einschränkung entfernt

// GET /api/students
// Unterstützt Parameter: q (bevorzugt) oder search
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('q') || searchParams.get('search') || '').trim();
  const klasseParams = Array.from(new Set([
    ...searchParams.getAll('klasse').map(s=>s.trim()).filter(Boolean),
    ...(searchParams.get('klasse') ? [String(searchParams.get('klasse')).trim()] : [])
  ]));
  const angebot = (searchParams.get('angebot') || '').trim();
  // Mehrfachwerte unterstützen (sowohl getAll als auch einzelner Fallback)
  const stufeParams = Array.from(new Set([
    ...searchParams.getAll('stufe').map(s => s.trim()).filter(Boolean),
    ...(searchParams.get('stufe') ? [String(searchParams.get('stufe')).trim()] : [])
  ]));
  const statusParams = Array.from(new Set([
    ...searchParams.getAll('status').map(s => s.trim()).filter(Boolean),
    ...(searchParams.get('status') ? [String(searchParams.get('status')).trim()] : [])
  ]));
  const jahrParams = Array.from(new Set([
    ...searchParams.getAll('jahr').map(s => s.trim()).filter(Boolean),
    ...(searchParams.get('jahr') ? [String(searchParams.get('jahr')).trim()] : [])
  ]));
  const religionParams = Array.from(new Set([
    ...searchParams.getAll('religion').map(s => s.trim()).filter(Boolean),
    ...(searchParams.get('religion') ? [String(searchParams.get('religion')).trim()] : [])
  ]));
  const onlyNames = searchParams.has('onlyNames');
  const schwerpunkt = (searchParams.get('schwerpunkt') || '').trim();
  const fields = (searchParams.get('fields') || '').trim(); // Kommagetrennte Feldliste
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
  const skip = Number(searchParams.get('skip') || 0);
  const client = await clientPromise;
  const db = client.db();
  const col = db.collection('students');
  const includeDeleted = searchParams.get('includeDeleted') === '1';
  let filter: Record<string, unknown> = {};
  if (raw) {
    // Split nach Leerzeichen für einfache UND-Suche (alle Tokens müssen matchen)
    const tokens = raw.split(/\s+/).filter(Boolean);
    // Flexible Regex-Erzeugung: Akzent-/Diakritika-unabhängig (Jose -> findet José, İpek -> finden mit Ipek etc.)
    const variantMap: Record<string,string> = {
      a: 'aàáâäãåāą',
      c: 'cçčć',
      e: 'eèéêëēėęě',
      i: 'iıíîïīįì', // enthält türkisches ı
      o: 'oòóôöõōőø',
      u: 'uùúûüūůű',
      y: 'yÿý',
      s: 'sśšß',
      n: 'nñńň',
      l: 'lł',
      d: 'dď',
      t: 'tť',
      z: 'zźżž',
      g: 'gğ',
      r: 'rř'
    };
    const regexSpecial = /[.*+?^${}()|[\]\\]/g;
    function escape(ch: string){ return ch.replace(regexSpecial, r=> '\\' + r); }
    function tokenToPattern(token: string){
      let out = '';
      for(const rawCh of token.toLowerCase()){
        if(variantMap[rawCh]){
          // Zeichenklasse mit allen Varianten
          const chars = variantMap[rawCh];
          out += '[' + chars + ']';
        } else {
          out += escape(rawCh);
        }
      }
      return out;
    }
    const makeRegex = (t: string) => ({ $regex: tokenToPattern(t), $options: 'i' });
  const fieldNames = onlyNames ? ['Vorname','Familienname'] : ['Vorname','Familienname','Benutzername'];
    filter = {
      $and: tokens.map(t => ({
        $or: fieldNames.map(fn => ({ [fn]: makeRegex(t) }))
      }))
    };
  }
  if (klasseParams.length) {
    // Ausschließlich Feld '25/26' als Klassenfilter
    const orList: Record<string, unknown>[] = [];
    for (const k of klasseParams) {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const spacedPattern = escaped.split('').map(ch=> ch + '\\s*').join('');
      const rx = { $regex: `^${spacedPattern}$`, $options: 'i' };
      orList.push({ '25/26': rx });
    }
    const klasseFilter = { $or: orList };
    filter = Object.keys(filter).length ? { $and: [filter, klasseFilter] } : klasseFilter;
  }
  if (angebot) {
    // Exakte (case-insensitive) Übereinstimmung eines Array-Elements in Angebote
    const escaped = angebot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const angebotFilter = { Angebote: { $regex: `^${escaped}$`, $options: 'i' } };
    filter = Object.keys(filter).length ? { $and: [filter, angebotFilter] } : angebotFilter;
  }
  if (stufeParams.length) {
    // Exakt (case-insensitive); "0" bedeutet leere/fehlende Stufe
    const ors: Record<string, unknown>[] = [];
    for (const s of stufeParams) {
      if (s === '0') {
        ors.push({ 'Stufe 25/26': { $in: [null, '', '-', '—', 0, '0'] } });
      } else {
        const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        ors.push({ 'Stufe 25/26': { $regex: `^${escaped}$`, $options: 'i' } });
      }
    }
    const stufeFilter = { $or: ors };
    filter = Object.keys(filter).length ? { $and: [filter, stufeFilter] } : stufeFilter;
  }
  if (statusParams.length) {
    const ors = statusParams.map(s => ({ Status: { $regex: `^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }));
    const statusFilter = { $or: ors };
    filter = Object.keys(filter).length ? { $and: [filter, statusFilter] } : statusFilter;
  }
  if (jahrParams.length) {
    const ors = jahrParams.map(s => ({ Besuchsjahr: { $regex: `^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }));
    const jahrFilter = { $or: ors };
    filter = Object.keys(filter).length ? { $and: [filter, jahrFilter] } : jahrFilter;
  }
  if (religionParams.length) {
    const ors = religionParams.map(s => ({ Religion: { $regex: `^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }));
    const religionFilter = { $or: ors };
    filter = Object.keys(filter).length ? { $and: [filter, religionFilter] } : religionFilter;
  }
  if (schwerpunkt) {
    // Exakte (case-insensitive) Übereinstimmung in Schwerpunkte (Array oder String) oder Schwerpunkt (Singular)
    const escaped = schwerpunkt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const schwerpunktFilter = {
      $or: [
        { Schwerpunkte: { $regex: `(^|[,;/\\s])${escaped}([,;/\\s]|$)`, $options: 'i' } },
        { Schwerpunkt: { $regex: `(^|[,;/\\s])${escaped}([,;/\\s]|$)`, $options: 'i' } }
      ]
    };
    filter = Object.keys(filter).length ? { $and: [filter, schwerpunktFilter] } : schwerpunktFilter;
  }
  // Nur dann Projection verwenden, wenn explizit Felder angefordert wurden.
  // Bisherige Logik lieferte sonst nur Geschlecht und blendete den Rest aus -> "leere" Datensätze.
  let projection: Record<string, number> | undefined = undefined;
  if (fields) {
  // Immer Geschlecht, Legacy 'm/w', '25/26' und 'Klasse 25/26' projizieren
  projection = { Geschlecht: 1, 'm/w': 1, '25/26': 1, 'Klasse 25/26': 1 };
    for (const f of fields.split(',').map(s=>s.trim()).filter(Boolean)) projection[f] = 1;
  }
  if (!includeDeleted) {
    filter = Object.keys(filter).length ? { $and: [filter, { _deleted: { $ne: true } }] } : { _deleted: { $ne: true } };
  }
  const total = await col.countDocuments(filter);
  const cursor = col.find(filter, projection ? { projection } : undefined)
    .skip(skip)
    .limit(limit)
    .sort({ Familienname: 1, Vorname: 1 })
  const docs = await cursor.toArray();
  // Feld-Synchronisierung & automatische Reparatur zwischen 'Klasse 25/26' und kanonischem '25/26'
  const bulkOps: AnyBulkWriteOperation<Document>[] = [];
  for(const d of docs){
    const anyDoc = d as Record<string, unknown>;
    const originalId = (d as { _id: ObjectId })._id;
    // Fülle '25/26' aus möglichem internem _doc (nur falls vorhanden typunsicher)
    const inner = (d as unknown as { _doc?: Document })._doc;
    if(!('25/26' in anyDoc) && inner && inner['25/26'] != null) {
      anyDoc['25/26'] = inner['25/26'];
    }
    // Wenn nur 'Klasse 25/26' existiert oder abweicht -> angleichen
    const kDisplay = (anyDoc['Klasse 25/26'] ?? '').toString().trim();
    const kCanon = (anyDoc['25/26'] ?? '').toString().trim();
    if(kDisplay && !kCanon){
      anyDoc['25/26'] = kDisplay;
  bulkOps.push({ updateOne: { filter: { _id: originalId }, update: { $set: { '25/26': kDisplay } } } });
    } else if(kDisplay && kCanon && kDisplay !== kCanon){
      // Konflikt: beide gesetzt, aber verschieden -> Anzeige-Feld ist Quelle der Wahrheit
      anyDoc['25/26'] = kDisplay;
      bulkOps.push({ updateOne: { filter: { _id: originalId }, update: { $set: { '25/26': kDisplay } } } });
    }
    // Falls Anzeige-Feld leer aber kanonisch vorhanden -> Anzeige nachziehen
    if(!kDisplay && kCanon){
      anyDoc['Klasse 25/26'] = kCanon;
  bulkOps.push({ updateOne: { filter: { _id: originalId }, update: { $set: { 'Klasse 25/26': kCanon } } } });
    }
    // Stufe Fallbacks und Geschlecht bleiben erhalten
    if(anyDoc['Stufe 24/25'] && !anyDoc['Stufe 25/26']) anyDoc['Stufe 25/26'] = anyDoc['Stufe 24/25'];
    if(anyDoc['Stufe 24/25_1'] && !anyDoc['Stufe 25/26']) anyDoc['Stufe 25/26'] = anyDoc['Stufe 24/25_1'];
    if(anyDoc['BJ'] && !anyDoc['Besuchsjahr']) anyDoc['Besuchsjahr'] = anyDoc['BJ'];
    if(anyDoc['m/w'] && !anyDoc['Geschlecht']) {
      const gRaw = String(anyDoc['m/w']).trim().toLowerCase();
      anyDoc['Geschlecht'] = gRaw.startsWith('m') ? 'm' : gRaw.startsWith('w') ? 'w' : '';
      if(!anyDoc['Geschlecht']) delete anyDoc['Geschlecht'];
    }
  }
  if(bulkOps.length){
    try { await col.bulkWrite(bulkOps, { ordered: false }); } catch { /* ignore repair errors */ }
  }
  return NextResponse.json({ total, items: docs });
}

// POST /api/students  (Neuen Schüler anlegen)
export async function POST(request: Request) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const col = db.collection('students');
    const body = await request.json();
    const now = new Date().toISOString();
    body.createdAt = now;
    body.updatedAt = now;
    // Klasse-Feld-Synchronisierung bei Neuanlage
    if (Object.prototype.hasOwnProperty.call(body, 'Klasse 25/26')) {
      const rawK = body['Klasse 25/26'];
      const normK = typeof rawK === 'string' ? rawK.trim() : (rawK == null ? '' : String(rawK));
      if (normK) {
        body['Klasse 25/26'] = normK;
        body['25/26'] = normK; // Kanonisches Feld
      } else {
        body['25/26'] = '';
      }
    }
    // NormBenutzername nur setzen, wenn Benutzername nach Trim nicht leer
    if (typeof body.Benutzername === 'string') {
      const trimmed = body.Benutzername.trim();
      body.Benutzername = trimmed; // gespeicherte Variante ohne führende/trailing Spaces
      if (trimmed) {
        body.NormBenutzername = trimmed.toLowerCase();
      } else {
        delete body.NormBenutzername; // keine leere Normalisierung speichern
      }
    }
    // Passwort Hash wird im separaten PATCH gehandhabt; hier Klartext nur übernehmen
    const ins = await col.insertOne(body);
    const doc = await col.findOne({ _id: ins.insertedId });
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 });
  }
}
