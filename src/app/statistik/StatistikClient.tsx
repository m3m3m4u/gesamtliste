"use client";
import React, { useMemo } from 'react';

type YearStats = { total: number; w: number; m: number };
type StufenMap = Record<string, { w: number; m: number }>;
type Aggregated = { total: number; w: number; m: number; stufen: StufenMap; years?: Record<string, YearStats> };

type Row = {
  klasse: string;
  total: number;
  w: number;
  m: number;
  stufen: StufenMap;
  years: Record<string, YearStats>;
}

type DataProp = {
  classes: string[];
  stufen: string[];
  years: string[];
  map: Record<string, Record<string, YearStats>>;
  aggregatedMap: Record<string, Aggregated>;
}

export default function StatistikClient({ data }: { data: DataProp }) {

  const rows: Row[] = useMemo(() => {
    return data.classes.map((cls) => {
      const agg = data.aggregatedMap[cls] ?? { total: 0, w: 0, m: 0, stufen: {} } as Aggregated;
      return { klasse: cls, years: agg.years ?? {}, total: agg.total, w: agg.w, m: agg.m, stufen: agg.stufen };
    });
    // data is stable from server; including it in deps is fine
  }, [data]);

  type SummItem = { klasse: string; total: number; w: number; m: number; all: number; years: Record<string, YearStats>; stufen: StufenMap };
  const summarized = useMemo((): SummItem[] => rows.map((r) => ({ klasse: r.klasse, total: r.total, w: r.w, m: r.m, all: r.total, years: r.years, stufen: r.stufen })), [rows]);
  // No sorting: preserve server-provided class order
  const sorted = summarized;

  return (
  <div className="w-full overflow-x-auto">
  {/* No client-side sorting controls — server order is used */}
  <table className="min-w-[520px] table-fixed border-collapse mx-auto">
        <colgroup>
          {/* Klasse wider, Gesamt und w/m schmaler, dann für jede Stufe zwei schmale Spalten */}
  <col style={{ width: '120px' }} />
  <col style={{ width: '36px' }} />
  <col style={{ width: '24px' }} />
  <col style={{ width: '24px' }} />
    {data.stufen.map((s) => (
      <React.Fragment key={'col_' + s}>
    <col style={{ width: '22px' }} />
    <col style={{ width: '22px' }} />
      </React.Fragment>
      ))}
  {/* no trailing m/w columns */}
        </colgroup>
          <thead>
            <tr className="bg-gray-100 border-t-2 border-b-2">
              <th className="border px-1 py-0.5 whitespace-nowrap">Klasse</th>
              <th className="border px-2 py-1 text-right whitespace-nowrap">Schüler</th>
              <th className="border px-2 py-1 text-center whitespace-nowrap" colSpan={2}>Gesamt</th>
              {data.stufen.map((s,i) => (
                <th key={s} className={`border px-2 py-1 text-center whitespace-nowrap ${i>0? 'border-l-2':''}`} colSpan={2}>{'Stufe ' + s}</th>
              ))}
            </tr>
            <tr className="bg-gray-100 border-b-2">
              {/* placeholders for Klasse and Schüler */}
              <th className="border px-2 py-1" />
              <th className="border px-2 py-1" />
              {/* Gesamt: w then m */}
              <th className="border px-2 py-1 whitespace-nowrap text-center">w</th>
              <th className="border px-2 py-1 whitespace-nowrap text-center border-r-2">m</th>
              {data.stufen.map((s, idx) => (
                <React.Fragment key={s + '_sub'}>
                  <th className="border px-2 py-1 whitespace-nowrap">w</th>
                  <th className="border px-2 py-1 whitespace-nowrap border-r-2">m</th>
                </React.Fragment>
              ))}
              {/* no final trailing m & w */}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r=> (
              <tr key={r.klasse} className="hover:bg-gray-50 odd:bg-white even:bg-gray-50 border-b-2">
                <td className="border px-2 py-1">{r.klasse}</td>
                <td className="border px-2 py-1 text-right">{r.total}</td>
                <td className="border px-2 py-1 text-right text-red-600">{r.w}</td>
                <td className="border px-2 py-1 text-right text-blue-600 border-r-2">{r.m}</td>
                {data.stufen.map((s, idx) => {
                  const st = r.stufen[s] || { w: 0, m: 0 };
                  return (
                    <React.Fragment key={r.klasse + '_' + s}>
                      {idx >= Math.max(0, data.stufen.length - 2) ? (
                        <>
                          <td className="border px-2 py-1 text-right text-red-600">{st.w}</td>
                          <td className="border px-2 py-1 text-right text-blue-600 border-r-2">{st.m}</td>
                        </>
                      ) : (
                        <>
                          <td className="border px-2 py-1 text-right text-red-600">{st.w}</td>
                          <td className="border px-2 py-1 text-right text-blue-600 border-r-2">{st.m}</td>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
                  {/* no final trailing m & w cells */}
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}
