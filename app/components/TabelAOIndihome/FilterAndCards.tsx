'use client';

import React from 'react';
import { format } from 'date-fns';

interface FilterAndCardsProps {
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  statusDateFrom: string;
  setStatusDateFrom: (value: string) => void;
  statusDateTo: string;
  setStatusDateTo: (value: string) => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  processData: () => void;
  exportToPNG: () => void;
  filteredData: any[];
  result: any;
  getDataForMetric: (type: string) => any[];
  downloadData: (data: any[], label: string) => void;
}

export default function FilterAndCards({
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  statusDateFrom,
  setStatusDateFrom,
  statusDateTo,
  setStatusDateTo,
  handleFileUpload,
  processData,
  exportToPNG,
  filteredData,
  result,
  getDataForMetric,
  downloadData,
}: FilterAndCardsProps) {
  return (
    <>
      {/* FILTER */}
      <div className="bg-white p-3 rounded-lg shadow-md mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">📅 DATECREATED</label>
            <div className="flex gap-1">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
              <span className="text-slate-400 text-xs self-center">—</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">📅 STATUSDATE</label>
            <div className="flex gap-1">
              <input type="date" value={statusDateFrom} onChange={(e) => setStatusDateFrom(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
              <span className="text-slate-400 text-xs self-center">—</span>
              <input type="date" value={statusDateTo} onChange={(e) => setStatusDateTo(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="block text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
          <button onClick={processData} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-4 rounded-lg">🔍 Proses Data</button>
          <button onClick={exportToPNG} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-4 rounded-lg">🖼️ Export PNG</button>
        </div>
        <p className="text-xs text-blue-600 font-semibold mt-1">📊 {filteredData.length} baris data ditampilkan</p>
      </div>

      {/* KARTU */}
      {filteredData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          {[
            { key: 'RE', label: 'TOTAL RE', val: result.totalRE, sub: 'Semua order', color: 'blue', bg: 'blue-100', text: 'blue-700' },
            { key: 'PS', label: 'TOTAL PS', val: result.totalPS, sub: 'COMPWORK', color: 'green', bg: 'green-100', text: 'green-700' },
            { key: 'CANCEL', label: 'CANCEL', val: result.totalCANCEL, sub: 'CANCLWORK', color: 'red', bg: 'red-100', text: 'red-700' },
            { key: 'KENDALA_TEKNIK', label: 'KENDALA TEKNIK', val: result.totalKendalaTeknik, sub: 'WORKFAIL', color: 'amber', bg: 'amber-100', text: 'amber-700' },
            { key: 'KENDALA_PELANGGAN', label: 'KENDALA PELANGGAN', val: result.totalKendalaPelanggan, sub: 'WORKFAIL', color: 'violet', bg: 'violet-100', text: 'violet-700' },
            { key: 'KENDALA_LAINNYA', label: 'KENDALA LAINNYA', val: result.totalKendalaLainnya, sub: 'WORKFAIL', color: 'slate', bg: 'slate-100', text: 'slate-700' },
          ].map((item) => (
            <div key={item.key} className={`bg-white p-2 rounded-lg shadow-md border-l-4 border-${item.color}-500 relative`}>
              <p className="text-[10px] text-slate-500 font-semibold">{item.label}</p>
              <p className={`text-lg font-bold text-${item.color}-600`}>{item.val.toLocaleString()}</p>
              <p className="text-[8px] text-slate-400">{item.sub}</p>
              <button onClick={() => { const d = getDataForMetric(item.key); downloadData(d, item.key); }} className={`absolute top-1 right-1 text-[10px] bg-${item.bg} hover:bg-${item.color}-200 text-${item.text} px-1.5 py-0.5 rounded`}>📥</button>
            </div>
          ))}
          <div className={`bg-white p-2 rounded-lg shadow-md border-l-4 ${result.psRePercent >= 85 ? 'border-green-500' : 'border-yellow-500'}`}>
            <p className="text-[10px] text-slate-500 font-semibold">% PS/RE</p>
            <p className={`text-lg font-bold ${result.psRePercent >= 85 ? 'text-green-600' : 'text-yellow-600'}`}>{result.psRePercent.toFixed(2)}%</p>
            <p className="text-[8px] text-slate-400">Target 85%</p>
          </div>
        </div>
      )}
    </>
  );
}