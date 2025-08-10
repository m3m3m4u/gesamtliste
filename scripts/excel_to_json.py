import pandas as pd
import json
import tkinter as tk
from tkinter import filedialog

root = tk.Tk(); root.withdraw()
excel_file = filedialog.askopenfilename(title='Excel-Datei auswählen', filetypes=[('Excel-Dateien','*.xlsx *.xls')])
if not excel_file:
    print('❌ Keine Datei ausgewählt – Abbruch.')
    raise SystemExit

df = pd.read_excel(excel_file, dtype=str)

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
