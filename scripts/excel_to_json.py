import pandas as pd
import json
import tkinter as tk
from tkinter import filedialog

root = tk.Tk(); root.withdraw()
excel_file = filedialog.askopenfilename(title='Excel-Datei auswählen', filetypes=[('Excel-Dateien','*.xlsx *.xls')])
if not excel_file:
    print('❌ Keine Datei ausgewählt – Abbruch.')
    raise SystemExit

try:
    df = pd.read_excel(excel_file, dtype=str)
except PermissionError as e:
    print('⚠️  PermissionError – versuche Kopie anzulegen (Datei vielleicht in Excel geöffnet oder von OneDrive blockiert):')
    import shutil, tempfile, os
    tmpfile = os.path.join(tempfile.gettempdir(), 'gesamtliste_excel_tmp.xlsx')
    try:
        shutil.copyfile(excel_file, tmpfile)
        print('→ Kopie erstellt:', tmpfile)
        df = pd.read_excel(tmpfile, dtype=str)
    except Exception as e2:
        print('❌ Fallback ebenfalls fehlgeschlagen:', e2)
        raise

""" Dynamische Erkennung von Angebot-Spalten.
Akzeptiert Varianten wie Angebot1 / Angebot 1 / Angebot_1 (Groß/Kleinschreibung egal)."""
offer_cols = []
for c in df.columns:
    low = str(c).lower().strip().replace(' ', '').replace('_','')
    if low.startswith('angebot') and len(low) > len('angebot'):
        # rest muss eine Zahl sein
        rest = low[len('angebot'):]
        if rest.isdigit():
            offer_cols.append(c)

def collect_offers(row):
    vals = []
    for oc in offer_cols:
        v = row.get(oc)
        if pd.notna(v):
            s = str(v).strip()
            if s:
                vals.append(s)
    return vals

if offer_cols:
    df['Angebote'] = df.apply(collect_offers, axis=1)
    # Entferne nur existierende Angebot-Spalten
    df = df.drop(columns=[c for c in offer_cols if c in df.columns])
else:
    if 'Angebote' not in df.columns:
        df['Angebote'] = [[] for _ in range(len(df))]

json_data = df.to_dict(orient='records')
json_file = filedialog.asksaveasfilename(title='JSON-Datei speichern unter', defaultextension='.json', filetypes=[('JSON-Dateien','*.json')])
if not json_file:
    print('❌ Kein Speicherort ausgewählt – Abbruch.')
    raise SystemExit

with open(json_file,'w',encoding='utf-8') as f:
    json.dump(json_data,f,ensure_ascii=False,indent=2)

print('✅ JSON-Datei erstellt:', json_file)
