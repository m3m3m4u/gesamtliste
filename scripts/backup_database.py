#!/usr/bin/env python3
"""
MongoDB Datenbank-Backup-Skript für die Gesamtliste-Anwendung.

Verwendung:
    python scripts/backup_database.py
    
    Optionen:
        --output DIR    Ausgabeverzeichnis (Standard: backups/)
        --collections   Nur bestimmte Collections sichern (kommasepariert)
        --pretty        JSON formatiert ausgeben
        
Beispiele:
    python scripts/backup_database.py
    python scripts/backup_database.py --output ./meine_backups
    python scripts/backup_database.py --collections students,options --pretty
"""

import os
import json
import argparse
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus

try:
    from pymongo import MongoClient
    from bson import ObjectId
    from bson.json_util import dumps, RELAXED_JSON_OPTIONS
except ImportError:
    print("Fehler: pymongo ist nicht installiert.")
    print("Bitte installieren mit: pip install pymongo")
    exit(1)


class JSONEncoder(json.JSONEncoder):
    """Custom JSON Encoder für MongoDB-Dokumente."""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def load_env():
    """Lädt Umgebungsvariablen aus .env.local"""
    env_path = Path(__file__).parent.parent / ".env.local"
    env_vars = {}
    
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
    
    return env_vars


def get_mongodb_uri():
    """Holt die MongoDB URI aus Umgebungsvariablen oder .env.local"""
    # Zuerst aus Umgebungsvariablen
    uri = os.environ.get("MONGODB_URI")
    
    if not uri:
        # Dann aus .env.local
        env_vars = load_env()
        uri = env_vars.get("MONGODB_URI")
    
    if not uri:
        raise ValueError(
            "MONGODB_URI nicht gefunden. "
            "Bitte in .env.local setzen oder als Umgebungsvariable definieren."
        )
    
    return uri


def backup_collection(collection, pretty=False):
    """Exportiert alle Dokumente einer Collection."""
    documents = list(collection.find())
    
    # Konvertiere ObjectIds und Datumsangaben
    for doc in documents:
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                doc[key] = str(value)
            elif isinstance(value, datetime):
                doc[key] = value.isoformat()
    
    return documents


def create_backup(output_dir: Path, collections_filter: list = None, pretty: bool = False):
    """
    Erstellt ein Backup der gesamten Datenbank oder ausgewählter Collections.
    
    Args:
        output_dir: Verzeichnis für die Backup-Dateien
        collections_filter: Liste von Collection-Namen (None = alle)
        pretty: JSON formatiert ausgeben
    """
    # Verbindung zur Datenbank
    uri = get_mongodb_uri()
    print(f"Verbinde mit MongoDB...")
    
    client = MongoClient(uri)
    
    # Datenbank-Name aus URI extrahieren oder Standard verwenden
    db_name = client.get_database().name
    if not db_name or db_name == "test":
        db_name = "gesamtliste"
    
    db = client[db_name]
    print(f"Datenbank: {db_name}")
    
    # Timestamp für Dateinamen
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    
    # Ausgabeverzeichnis erstellen
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Collections auflisten
    all_collections = db.list_collection_names()
    
    if collections_filter:
        collections_to_backup = [c for c in collections_filter if c in all_collections]
        missing = set(collections_filter) - set(all_collections)
        if missing:
            print(f"Warnung: Folgende Collections existieren nicht: {missing}")
    else:
        collections_to_backup = all_collections
    
    if not collections_to_backup:
        print("Keine Collections zum Sichern gefunden.")
        return
    
    print(f"\nSichere {len(collections_to_backup)} Collection(s)...")
    print("-" * 50)
    
    backup_summary = {
        "timestamp": timestamp,
        "database": db_name,
        "collections": {}
    }
    
    # Einzelne Collections sichern
    for coll_name in collections_to_backup:
        collection = db[coll_name]
        documents = backup_collection(collection, pretty)
        count = len(documents)
        
        # Dateiname für diese Collection
        filename = f"{coll_name}-backup-{timestamp}.json"
        filepath = output_dir / filename
        
        # JSON speichern
        indent = 2 if pretty else None
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(documents, f, cls=JSONEncoder, ensure_ascii=False, indent=indent)
        
        file_size = filepath.stat().st_size
        size_str = format_size(file_size)
        
        print(f"  ✓ {coll_name}: {count} Dokumente ({size_str}) -> {filename}")
        
        backup_summary["collections"][coll_name] = {
            "count": count,
            "file": filename,
            "size_bytes": file_size
        }
    
    # Gesamt-Backup (alle Collections in einer Datei)
    print("-" * 50)
    
    full_backup = {}
    for coll_name in collections_to_backup:
        collection = db[coll_name]
        full_backup[coll_name] = backup_collection(collection, pretty)
    
    full_filename = f"full-backup-{timestamp}.json"
    full_filepath = output_dir / full_filename
    
    indent = 2 if pretty else None
    with open(full_filepath, "w", encoding="utf-8") as f:
        json.dump(full_backup, f, cls=JSONEncoder, ensure_ascii=False, indent=indent)
    
    full_size = full_filepath.stat().st_size
    total_docs = sum(len(docs) for docs in full_backup.values())
    
    print(f"\n✓ Gesamt-Backup: {total_docs} Dokumente ({format_size(full_size)})")
    print(f"  -> {full_filepath}")
    
    # Zusammenfassung speichern
    summary_filepath = output_dir / f"backup-summary-{timestamp}.json"
    backup_summary["full_backup"] = {
        "file": full_filename,
        "total_documents": total_docs,
        "size_bytes": full_size
    }
    
    with open(summary_filepath, "w", encoding="utf-8") as f:
        json.dump(backup_summary, f, ensure_ascii=False, indent=2)
    
    print(f"\nBackup-Zusammenfassung: {summary_filepath}")
    print("\n✓ Backup erfolgreich abgeschlossen!")
    
    client.close()
    return backup_summary


def format_size(size_bytes):
    """Formatiert Bytes in lesbare Größe."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def main():
    parser = argparse.ArgumentParser(
        description="MongoDB Datenbank-Backup für Gesamtliste",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Beispiele:
  python backup_database.py                          # Komplettes Backup
  python backup_database.py --pretty                 # Formatiertes JSON
  python backup_database.py --collections students   # Nur students Collection
  python backup_database.py --output ./mein_backup   # Anderes Verzeichnis
        """
    )
    
    parser.add_argument(
        "--output", "-o",
        type=str,
        default=None,
        help="Ausgabeverzeichnis (Standard: backups/)"
    )
    
    parser.add_argument(
        "--collections", "-c",
        type=str,
        default=None,
        help="Kommaseparierte Liste von Collections (Standard: alle)"
    )
    
    parser.add_argument(
        "--pretty", "-p",
        action="store_true",
        help="JSON formatiert ausgeben"
    )
    
    args = parser.parse_args()
    
    # Ausgabeverzeichnis
    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = Path(__file__).parent.parent / "backups"
    
    # Collections Filter
    collections_filter = None
    if args.collections:
        collections_filter = [c.strip() for c in args.collections.split(",")]
    
    print("=" * 50)
    print("MongoDB Datenbank-Backup")
    print("=" * 50)
    print(f"Ausgabeverzeichnis: {output_dir.absolute()}")
    if collections_filter:
        print(f"Collections: {', '.join(collections_filter)}")
    else:
        print("Collections: alle")
    print()
    
    try:
        create_backup(output_dir, collections_filter, args.pretty)
    except Exception as e:
        print(f"\n❌ Fehler beim Backup: {e}")
        exit(1)


if __name__ == "__main__":
    main()
