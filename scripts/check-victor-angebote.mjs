import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;

async function main() {
  const client = await MongoClient.connect(uri);
  const db = client.db();
  
  // Victor Preda suchen
  const student = await db.collection('students').findOne({ 
    Vorname: 'Victor', 
    Familienname: 'Preda', 
    _deleted: { $ne: true } 
  });
  
  if (!student) {
    console.log('Victor Preda nicht gefunden!');
    await client.close();
    return;
  }
  
  console.log('=== Victor Preda Daten ===');
  console.log('_id:', student._id);
  console.log('Klasse:', student['Klasse 25/26'] || student['Klasse 26/27']);
  console.log('Angebote im Schüler-Datensatz:', JSON.stringify(student.Angebote, null, 2));
  console.log('Schwerpunkte:', student.Schwerpunkte || student.Schwerpunkt);
  
  // Erlaubte Angebote aus Optionen
  const optionen = await db.collection('config').findOne({ _id: 'optionen' });
  console.log('\n=== Erlaubte Angebote aus Optionen ===');
  console.log(JSON.stringify(optionen?.angebote, null, 2));
  
  // Prüfen, welche gefiltert werden
  if (student.Angebote && Array.isArray(student.Angebote)) {
    const erlaubte = optionen?.angebote || [];
    console.log('\n=== Filterung (STRIKTE Logik) ===');
    for (const angebot of student.Angebote) {
      const normalized = normalizeAngebot(angebot);
      const istErlaubt = isErlaubtesAngebot(angebot, erlaubte);
      console.log(`"${angebot}" -> normalized: "${normalized}" -> erlaubt: ${istErlaubt}`);
    }
    
    // Zeige, welche jetzt übrig bleiben
    const gefilterteAngebote = student.Angebote.filter(a => isErlaubtesAngebot(a, erlaubte));
    console.log('\n=== Gefilterte Angebote (die angezeigt werden sollten) ===');
    console.log(gefilterteAngebote);
    
    // Zeige den generierten Satz
    if (gefilterteAngebote.length > 0) {
      const angeboteNormalized = [...new Set(gefilterteAngebote.map(normalizeAngebot))];
      console.log('\n=== Normalisierte Angebote für Satz ===');
      console.log(angeboteNormalized);
    }
  }
  
  await client.close();
}

function normalizeAngebot(name) {
  // Klammern entfernen
  let result = name.replace(/\s*\([^)]*\)/g, '').trim();
  // "Freies Werken DI" / "Freies Werken MI" -> "Kreatives Werken"
  if (result.match(/^Freies Werken\s+(DI|MI)$/i)) {
    return 'Kreatives Werken';
  }
  // "in 80 Tönen" -> "In 80 Tönen um die Welt"
  if (result.toLowerCase() === 'in 80 tönen') {
    return 'In 80 Tönen um die Welt';
  }
  return result;
}

// Hilfsfunktion: Prüft ob ein Angebot in der erlaubten Liste ist
function isErlaubtesAngebot(angebot, erlaubte) {
  const normalized = normalizeAngebot(angebot).toLowerCase();
  return erlaubte.some(e => normalizeAngebot(e).toLowerCase() === normalized);
}

main().catch(console.error);
