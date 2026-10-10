'use client';

import React from 'react';
import { isSameDay } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

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

  const chartHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const hourlyChartData = {
    labels: chartHours.map((hour) => `${String(hour).padStart(2, '0')}:00`),
    datasets: [
      {
        label: 'RE',
        data: chartHours.map((hour) => hour <= currentHour ? grandTotalRE[hour] : null),
        borderColor: '#2563eb',
        backgroundColor: '#2563eb',
        tension: 0.25,
      },
      {
        label: 'PS',
        data: chartHours.map((hour) => hour <= currentHour ? grandTotalPS[hour] : null),
        borderColor: '#16a34a',
        backgroundColor: '#16a34a',
        tension: 0.25,
      },
    ],
  };
  const hourlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: { mode: 'index' as const, intersect: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  };
  const deviationPeriodLabel = currentHour >= 10
    ? `(${String(currentHour - 1).padStart(2, '0')}:00 vs ${String(currentHour - 2).padStart(2, '0')}:00)`
    : '(belum tersedia)';

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mb-6 relative" id="table-jam-container">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-bold text-slate-800">
          📋 Monitoring Pergerakan Order New Sales Indihome per-Jam (Hari Ini)
        </h2>
      </div>
      <div className="w-max min-w-full">
      <div className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Grafik pergerakan order per jam</h3>
        </div>
        <div className="h-72 min-h-72">
          <Line data={hourlyChartData} options={hourlyChartOptions} />
        </div>
      </div>
      <table className="w-max min-w-full text-[10px] border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold align-middle">REGIONAL</th>
            <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold align-middle">BRANCH</th>
            {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((jam) => (
              <th key={jam} colSpan={2} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">
                {String(jam).padStart(2, '0')}:00
              </th>
            ))}
            <th rowSpan={2} className="w-[88px] min-w-[88px] max-w-[88px] whitespace-normal break-words border border-slate-600 bg-slate-700 p-1 text-center font-bold leading-tight">
              DEV RE<br />{deviationPeriodLabel}
            </th>
            <th rowSpan={2} className="w-[88px] min-w-[88px] max-w-[88px] whitespace-normal break-words border border-slate-600 bg-slate-700 p-1 text-center font-bold leading-tight">
              DEV PS<br />{deviationPeriodLabel}
            </th>
            <th rowSpan={2} className="w-[88px] min-w-[88px] max-w-[88px] whitespace-normal break-words border border-slate-600 bg-slate-700 p-1 text-center font-bold leading-tight">
              DEV PS/RE (%)<br />{deviationPeriodLabel}
            </th>
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

              const totalRE = currentHour >= 8 ? item.reJam?.[currentHour] ?? 0 : 0;
              const totalPS = currentHour >= 8 ? item.psJam?.[currentHour] ?? 0 : 0;
              const psRePercent = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;
              const comparisonHour = currentHour - 2;
              const deviationHour = currentHour - 1;
              const comparisonRE = item.reJam?.[comparisonHour] ?? 0;
              const comparisonPS = item.psJam?.[comparisonHour] ?? 0;
              const deviationRE = item.reJam?.[deviationHour] ?? 0;
              const deviationPS = item.psJam?.[deviationHour] ?? 0;
              const comparisonPsRe = comparisonRE > 0 ? (comparisonPS / comparisonRE) * 100 : 0;
              const deviationPsRe = deviationRE > 0 ? (deviationPS / deviationRE) * 100 : 0;
              const reDeviation = deviationRE - comparisonRE;
              const psDeviation = deviationPS - comparisonPS;
              const psReDeviation = deviationPsRe - comparisonPsRe;
              const deltaClass = (value: number) => value > 0 ? 'text-green-700' : value < 0 ? 'text-red-700' : 'text-slate-500';
              const formatCountDelta = (value: number) => value > 0 ? `+${value}` : String(value);

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
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : deltaClass(reDeviation)}`}>
                    {currentHour < 10 ? '-' : formatCountDelta(reDeviation)}
                  </td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : deltaClass(psDeviation)}`}>
                    {currentHour < 10 ? '-' : formatCountDelta(psDeviation)}
                  </td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : deltaClass(psReDeviation)}`}>
                    {currentHour < 10 ? '-' : `${psReDeviation > 0 ? '+' : ''}${psReDeviation.toFixed(2)}%`}
                  </td>
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
    </div>
  );
}