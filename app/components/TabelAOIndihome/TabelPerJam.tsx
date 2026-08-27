'use client';

import React from 'react';
import { isSameDay } from 'date-fns';

interface TabelPerJamProps {
  filteredData: any[];
  dateFrom: string;
  dateTo: string;
  statusDateFrom: string;
  statusDateTo: string;
  today: Date;
  currentHour: number;
  regionalMapping: any;
  parseDate: (value: any) => Date | null;
  exportSection?: (elementId: string, fileName: string) => void;
}

export default function TabelPerJam({
  filteredData,
  dateFrom,
  dateTo,
  statusDateFrom,
  statusDateTo,
  today,
  currentHour,
  regionalMapping,
  parseDate,
  exportSection,
}: TabelPerJamProps) {
  // ============================================
  // HITUNG DATA PER JAM (HARI INI)
  // ============================================
  const calculateJamData = (branchData: any[], isRE: boolean) => {
    const jamRange = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    
    const perJam: { [key: string]: number } = {};
    jamRange.forEach(j => { perJam[j] = 0; });

    branchData.forEach((row: any) => {
      const dateField = isRE ? parseDate(row['DATECREATED']) : parseDate(row['STATUSDATE']);
      if (!dateField) return;
      const hour = dateField.getHours();
      
      for (let j = 8; j <= 23; j++) {
        if (hour <= j) {
          perJam[j] = (perJam[j] || 0) + 1;
          break;
        }
      }
    });

    const jamCounts: { [key: string]: number } = {};
    let cumulative = 0;
    jamRange.forEach(j => {
      cumulative += perJam[j] || 0;
      jamCounts[j] = cumulative;
    });

    return jamCounts;
  };

  // --- RE: Semua status, DATECREATED hari ini ---
  const reData = filteredData.filter((row: any) => {
    const dateCreated = parseDate(row['DATECREATED']);
    if (!dateCreated) return false;
    return isSameDay(dateCreated, today);
  });

  // --- PS: Hanya COMPWORK, STATUSDATE hari ini ---
  const psData = filteredData.filter((row: any) => {
    const statusDate = parseDate(row['STATUSDATE']);
    if (!statusDate) return false;
    if (row['STATUS'] !== 'COMPWORK') return false;
    return isSameDay(statusDate, today);
  });

  const branchGroups = new Map<string, any[]>();
  reData.forEach((row: any) => {
    const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
    if (!branchGroups.has(branch)) branchGroups.set(branch, []);
    branchGroups.get(branch)!.push(row);
  });

  const jamResult: any[] = [];
  branchGroups.forEach((reRows, branch) => {
    const psRows = psData.filter((row: any) => (row['DISTRICT_TIF'] || 'UNKNOWN') === branch);
    const reJam = calculateJamData(reRows, true);
    const psJam = calculateJamData(psRows, false);
    
    jamResult.push({
      branch,
      regional: regionalMapping[branch] || 'LAINNYA',
      reJam,
      psJam,
    });
  });

  const regionalOrder = ['BANTEN', 'EASTERN JABOTABEK', 'JAKARTA', 'JAWA BARAT'];
  jamResult.sort((a, b) => {
    const regA = regionalOrder.indexOf(a.regional);
    const regB = regionalOrder.indexOf(b.regional);
    if (regA !== regB) return regA - regB;
    return a.branch.localeCompare(b.branch);
  });

  const finalJamData: any[] = [];
  const regionalMapJam = new Map<string, any[]>();
  jamResult.forEach(item => {
    const reg = item.regional || 'LAINNYA';
    if (!regionalMapJam.has(reg)) regionalMapJam.set(reg, []);
    regionalMapJam.get(reg)!.push(item);
  });

  let grandTotalRE: any = {};
  let grandTotalPS: any = {};
  const jamRange = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  jamRange.forEach(j => {
    grandTotalRE[j] = 0;
    grandTotalPS[j] = 0;
  });

  regionalOrder.forEach(reg => {
    const items = regionalMapJam.get(reg) || [];
    if (items.length === 0) return;

    const subTotalRE: any = {};
    const subTotalPS: any = {};
    jamRange.forEach(j => {
      subTotalRE[j] = 0;
      subTotalPS[j] = 0;
    });

    items.forEach(item => {
      jamRange.forEach(j => {
        subTotalRE[j] += item.reJam[j] || 0;
        subTotalPS[j] += item.psJam[j] || 0;
        grandTotalRE[j] += item.reJam[j] || 0;
        grandTotalPS[j] += item.psJam[j] || 0;
      });
      finalJamData.push({ ...item, isSubTotal: false });
    });

    finalJamData.push({
      branch: 'SUB TOTAL',
      regional: reg,
      isSubTotal: true,
      reJam: subTotalRE,
      psJam: subTotalPS,
    });
  });

  finalJamData.push({
    branch: 'AREA 2',
    regional: 'GRAND TOTAL',
    isArea2: true,
    reJam: grandTotalRE,
    psJam: grandTotalPS,
  });

  if (filteredData.length === 0 || finalJamData.length === 0) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mb-6 relative" id="table-jam-container">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-bold text-slate-800">
          📋 Monitoring Pergerakan Order New Sales Indihome per-Jam (Hari Ini)
        </h2>
        {exportSection && (
          <button
            onClick={() => exportSection('tabel-perjam', 'PerJam')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        )}
      </div>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold align-middle">REGIONAL</th>
            <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold align-middle">BRANCH</th>
            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((jam) => (
              <th key={jam} colSpan={2} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">
                {String(jam).padStart(2, '0')}:00
              </th>
            ))}
            <th rowSpan={2} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE</th>
          </tr>
          <tr className="bg-slate-600 text-white">
            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((jam) => (
              <React.Fragment key={`header-${jam}`}>
                <th key={`${jam}-re`} className="border border-slate-500 p-0.5 text-center font-semibold">RE</th>
                <th key={`${jam}-ps`} className="border border-slate-500 p-0.5 text-center font-semibold">PS</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {(() => {
            const jamRowsWithSpan: any[] = [];
            let lastJamRegional = '';
            let jamRegionalCount = 0;

            finalJamData.forEach((item: any, idx: number) => {
              const isSubTotal = item.isSubTotal === true;
              const isArea2 = item.isArea2 === true;

              if (!isArea2) {
                if (item.regional !== lastJamRegional) {
                  jamRegionalCount = 1;
                  lastJamRegional = item.regional;
                  for (let i = idx + 1; i < finalJamData.length; i++) {
                    const next = finalJamData[i];
                    if (next.isArea2) break;
                    if (next.regional === item.regional) jamRegionalCount++;
                    else break;
                  }
                }
              }

              jamRowsWithSpan.push({
                ...item,
                idx,
                isSubTotal,
                isArea2,
                regionalCount: isArea2 ? 1 : (item.regional === lastJamRegional ? jamRegionalCount : 1),
                isFirstInRegional: !isArea2 && item.regional === lastJamRegional && (idx === 0 || finalJamData[idx - 1]?.regional !== item.regional),
              });
            });

            return jamRowsWithSpan.map((item: any) => {
              const rowColor = item.idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              const isSubTotal = item.isSubTotal === true;
              const isArea2 = item.isArea2 === true;
              let bgColor = rowColor;
              if (isSubTotal) bgColor = 'bg-blue-100';
              if (isArea2) bgColor = 'bg-slate-800 text-white';

              const totalRE = item.reJam?.[23] ?? 0;
              const totalPS = item.psJam?.[23] ?? 0;
              const psRePercent = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;

              return (
                <tr key={item.idx} className={`${bgColor} hover:bg-blue-50 transition-colors`}>
                  {isArea2 ? (
                    <td colSpan={2} className="border border-slate-300 p-1 font-bold text-white text-center bg-slate-800">AREA 2</td>
                  ) : (
                    <>
                      {item.isFirstInRegional ? (
                        <td rowSpan={item.regionalCount} className={`border border-slate-300 p-1 font-bold ${isSubTotal ? 'text-slate-800' : 'text-slate-800'}`}>
                          {isSubTotal ? '' : item.regional}
                        </td>
                      ) : null}
                      <td className={`border border-slate-300 p-1 font-semibold ${isSubTotal ? 'text-slate-700' : 'text-slate-700'}`}>
                        {isSubTotal ? 'SUB TOTAL' : item.branch}
                      </td>
                    </>
                  )}
                  {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((jam) => {
                    const reValue = jam <= currentHour ? (item.reJam?.[jam] ?? 0) : '';
                    const psValue = jam <= currentHour ? (item.psJam?.[jam] ?? 0) : '';
                    return (
                      <React.Fragment key={`${item.idx}-${jam}`}>
                        <td key={`${item.idx}-${jam}-re`} className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-blue-600 font-semibold'}`}>
                          {reValue}
                        </td>
                        <td key={`${item.idx}-${jam}-ps`} className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-green-600 font-semibold'}`}>
                          {psValue}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : (psRePercent >= 85 ? 'text-green-600' : 'text-red-600')}`}>
                    {currentHour < 8 ? '-' : psRePercent.toFixed(2) + '%'}
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  );
}