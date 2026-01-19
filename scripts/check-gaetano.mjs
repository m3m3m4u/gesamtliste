import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://schuleamsee:Seestra%C3%9Fe58@gesamtliste.g1m3f5b.mongodb.net/gesamtliste?retryWrites=true&w=majority&appName=Gesamtliste';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  
  const student = await db.collection('students').findOne({ 
    Vorname: /gaetano/i,
    _deleted: { $ne: true }
  });
  
  if (student) {
    console.log('Vorname:', student.Vorname);
    console.log('Familienname:', student.Familienname);
    console.log('Stufe 25/26:', student['Stufe 25/26']);
    console.log('Erstsprachunterricht:', student.Erstsprachunterricht);
    console.log('Geschlecht:', student['m/w'] || student.Geschlecht);
    console.log('_id:', student._id.toString());
  } else {
    console.log('Schüler nicht gefunden');
  }
  
  await client.close();
}

main();
