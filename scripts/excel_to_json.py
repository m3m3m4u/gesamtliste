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

def combine_offers(row):
    offers = [row.get('Angebot1'), row.get('Angebot2'), row.get('Angebot3')]
    return [o for o in offers if pd.notna(o) and str(o).strip()!='']

df['Angebote'] = df.apply(combine_offers, axis=1)
df = df.drop(columns=['Angebot1','Angebot2','Angebot3'])

json_data = df.to_dict(orient='records')
json_file = filedialog.asksaveasfilename(title='JSON-Datei speichern unter', defaultextension='.json', filetypes=[('JSON-Dateien','*.json')])
if not json_file:
    print('❌ Kein Speicherort ausgewählt – Abbruch.')
    raise SystemExit

with open(json_file,'w',encoding='utf-8') as f:
    json.dump(json_data,f,ensure_ascii=False,indent=2)

print('✅ JSON-Datei erstellt:', json_file)
