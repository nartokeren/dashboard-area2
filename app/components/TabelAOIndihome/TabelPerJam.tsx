'use client';

import React, { useState } from 'react';
import { isSameDay, startOfDay, subDays } from 'date-fns';
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
  const [copyFeedback, setCopyFeedback] = useState('');

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

  const referenceDate = dateTo ? startOfDay(new Date(`${dateTo}T00:00:00`)) : startOfDay(today);
  const h1ReferenceDate = subDays(referenceDate, 1);
  const effectiveHour = isSameDay(referenceDate, today) ? currentHour : 23;

  // --- RE: Semua status, DATECREATED pada tanggal referensi ---
  const reData = filteredData.filter((row: any) => {
    const dateCreated = parseDate(row['DATECREATED']);
    if (!dateCreated) return false;
    return isSameDay(dateCreated, referenceDate);
  });

  // --- PS: Hanya COMPWORK, STATUSDATE pada tanggal referensi ---
  const psData = filteredData.filter((row: any) => {
    const statusDate = parseDate(row['STATUSDATE']);
    if (!statusDate) return false;
    if (row['STATUS'] !== 'COMPWORK') return false;
    return isSameDay(statusDate, referenceDate);
  });

  const reH1Data = filteredData.filter((row: any) => {
    const dateCreated = parseDate(row['DATECREATED']);
    if (!dateCreated) return false;
    return isSameDay(dateCreated, h1ReferenceDate);
  });

  const psH1Data = filteredData.filter((row: any) => {
    const statusDate = parseDate(row['STATUSDATE']);
    if (!statusDate) return false;
    if (row['STATUS'] !== 'COMPWORK') return false;
    return isSameDay(statusDate, h1ReferenceDate);
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
    const reH1Rows = reH1Data.filter((row: any) => (row['DISTRICT_TIF'] || 'UNKNOWN') === branch);
    const psH1Rows = psH1Data.filter((row: any) => (row['DISTRICT_TIF'] || 'UNKNOWN') === branch);
    const reJam = calculateJamData(reRows, true);
    const psJam = calculateJamData(psRows, false);
    const reJamH1 = calculateJamData(reH1Rows, true);
    const psJamH1 = calculateJamData(psH1Rows, false);

    jamResult.push({
      branch,
      regional: regionalMapping[branch] || 'LAINNYA',
      reJam,
      psJam,
      reJamH1,
      psJamH1,
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
  let grandTotalREH1: any = {};
  let grandTotalPSH1: any = {};
  const jamRange = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  jamRange.forEach(j => {
    grandTotalRE[j] = 0;
    grandTotalPS[j] = 0;
    grandTotalREH1[j] = 0;
    grandTotalPSH1[j] = 0;
  });

  regionalOrder.forEach(reg => {
    const items = regionalMapJam.get(reg) || [];
    if (items.length === 0) return;

    const subTotalRE: any = {};
    const subTotalPS: any = {};
    const subTotalREH1: any = {};
    const subTotalPSH1: any = {};
    jamRange.forEach(j => {
      subTotalRE[j] = 0;
      subTotalPS[j] = 0;
      subTotalREH1[j] = 0;
      subTotalPSH1[j] = 0;
    });

    items.forEach(item => {
      jamRange.forEach(j => {
        subTotalRE[j] += item.reJam[j] || 0;
        subTotalPS[j] += item.psJam[j] || 0;
        subTotalREH1[j] += item.reJamH1[j] || 0;
        subTotalPSH1[j] += item.psJamH1[j] || 0;
        grandTotalRE[j] += item.reJam[j] || 0;
        grandTotalPS[j] += item.psJam[j] || 0;
        grandTotalREH1[j] += item.reJamH1[j] || 0;
        grandTotalPSH1[j] += item.psJamH1[j] || 0;
      });
      finalJamData.push({ ...item, isSubTotal: false });
    });

    finalJamData.push({
      branch: 'SUB TOTAL',
      regional: reg,
      isSubTotal: true,
      reJam: subTotalRE,
      psJam: subTotalPS,
      reJamH1: subTotalREH1,
      psJamH1: subTotalPSH1,
    });
  });

  finalJamData.push({
    branch: 'AREA 2',
    regional: 'GRAND TOTAL',
    isArea2: true,
    reJam: grandTotalRE,
    psJam: grandTotalPS,
    reJamH1: grandTotalREH1,
    psJamH1: grandTotalPSH1,
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
        data: chartHours.map((hour) => hour <= effectiveHour ? grandTotalRE[hour] : null),
        borderColor: '#2563eb',
        backgroundColor: '#2563eb',
        tension: 0.25,
      },
      {
        label: 'PS',
        data: chartHours.map((hour) => hour <= effectiveHour ? grandTotalPS[hour] : null),
        borderColor: '#16a34a',
        backgroundColor: '#16a34a',
        tension: 0.25,
      },
      {
        label: 'RE H-1',
        data: chartHours.map((hour) => hour <= effectiveHour ? grandTotalREH1[hour] : null),
        borderColor: '#93c5fd',
        backgroundColor: '#93c5fd',
        borderDash: [5, 5],
        tension: 0.25,
      },
      {
        label: 'PS H-1',
        data: chartHours.map((hour) => hour <= effectiveHour ? grandTotalPSH1[hour] : null),
        borderColor: '#86efac',
        backgroundColor: '#86efac',
        borderDash: [5, 5],
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
  const deviationPeriodLabel = effectiveHour >= 10
    ? `(${String(effectiveHour - 1).padStart(2, '0')}:00 vs ${String(effectiveHour - 2).padStart(2, '0')}:00)`
    : '(belum tersedia)';

  const branchStats = finalJamData
    .filter((item: any) => !item.isSubTotal && !item.isArea2)
    .map((item: any) => {
      const re = effectiveHour >= 8 ? item.reJam?.[effectiveHour] ?? 0 : 0;
      const ps = effectiveHour >= 8 ? item.psJam?.[effectiveHour] ?? 0 : 0;
      const reH1 = effectiveHour >= 8 ? item.reJamH1?.[effectiveHour] ?? 0 : 0;
      const psH1 = effectiveHour >= 8 ? item.psJamH1?.[effectiveHour] ?? 0 : 0;
      return {
        branch: item.branch,
        re,
        ps,
        psRe: re > 0 ? (ps / re) * 100 : 0,
        psReH1: reH1 > 0 ? (psH1 / reH1) * 100 : 0,
      };
    });

  const highestBranch = branchStats.length > 0
    ? [...branchStats].sort((first, second) => second.psRe - first.psRe)[0]
    : null;
  const lowestBranch = branchStats.length > 0
    ? [...branchStats].sort((first, second) => first.psRe - second.psRe)[0]
    : null;
  const area2RE = effectiveHour >= 8 ? grandTotalRE[effectiveHour] ?? 0 : 0;
  const area2PS = effectiveHour >= 8 ? grandTotalPS[effectiveHour] ?? 0 : 0;
  const area2PSRE = area2RE > 0 ? (area2PS / area2RE) * 100 : 0;
  const area2REH1 = effectiveHour >= 8 ? grandTotalREH1[effectiveHour] ?? 0 : 0;
  const area2PSH1 = effectiveHour >= 8 ? grandTotalPSH1[effectiveHour] ?? 0 : 0;
  const area2PSREH1 = area2REH1 > 0 ? (area2PSH1 / area2REH1) * 100 : 0;
  const psReDifference = area2PSRE - area2PSREH1;
  const psReDifferenceText = psReDifference > 0
    ? `naik ${psReDifference.toFixed(2)} poin`
    : psReDifference < 0
      ? `turun ${Math.abs(psReDifference).toFixed(2)} poin`
      : 'sama';

  let encouragement = '';
  if (area2PSRE < 60) {
    encouragement = 'Pencapaian PS/RE masih jauh dari target, sehingga tim lapangan perlu segera menutup hambatan, mempercepat penyelesaian pekerjaan, dan menjaga arus validasi agar kondisi hari ini tidak tertinggal lebih dalam.';
  } else if (area2PSRE < 85) {
    encouragement = 'Pencapaian PS/RE masih perlu diperkuat. Dengan prioritas pada pekerjaan yang sedang berjalan dan penanganan hambatan di lapangan secara cepat, target harian masih dapat dikejar.';
  } else {
    encouragement = 'Pencapaian PS/RE sudah mendekati target. Pertahankan ritme lapangan, rapikan sisa hambatan, dan pastikan pekerjaan yang diselesaikan tetap berkualitas.';
  }

  const h1Comparison = effectiveHour >= 8
    ? ` Dibanding H-1 pada jam yang sama, pencapaian kini ${psReDifferenceText} dari ${area2PSREH1.toFixed(2)}% menjadi ${area2PSRE.toFixed(2)}%.`
    : '';

  const summaryLines = [
    `*Summary Monitoring Pergerakan Order New Sales Indihome Area 2*`,
    `Pada pukul ${String(effectiveHour).padStart(2, '0')}:00, Area 2 mencatat RE ${area2RE} dan PS ${area2PS}, dengan pencapaian PS/RE ${area2PSRE.toFixed(2)}%.${h1Comparison}`,
    encouragement,
    highestBranch && lowestBranch
      ? `Performa paling kuat saat ini berada di *${highestBranch.branch}* dengan PS/RE ${highestBranch.psRe.toFixed(2)}% (H-1 ${highestBranch.psReH1.toFixed(2)}%), sedangkan yang masih paling perlu perhatian adalah *${lowestBranch.branch}* dengan ${lowestBranch.psRe.toFixed(2)}% (H-1 ${lowestBranch.psReH1.toFixed(2)}%).`
      : '',
  ].filter(Boolean);
  const jamSummary = summaryLines.join('\n');

  const copyJamSummary = async () => {
    try {
      await navigator.clipboard.writeText(jamSummary);
      setCopyFeedback('Summary tersalin');
      window.setTimeout(() => setCopyFeedback(''), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      setCopyFeedback('Gagal menyalin');
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mb-6 relative" id="table-jam-container">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-bold text-slate-800">
          📋 Monitoring Pergerakan Order New Sales Indihome per-Jam ({isSameDay(referenceDate, today) ? 'Hari Ini' : referenceDate.toLocaleDateString('id-ID')})
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
            <th rowSpan={2} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE H-1</th>
            <th rowSpan={2} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">DEV PS/RE<br />H-1</th>
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

              const totalRE = effectiveHour >= 8 ? item.reJam?.[effectiveHour] ?? 0 : 0;
              const totalPS = effectiveHour >= 8 ? item.psJam?.[effectiveHour] ?? 0 : 0;
              const psRePercent = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;
              const totalREH1 = effectiveHour >= 8 ? item.reJamH1?.[effectiveHour] ?? 0 : 0;
              const totalPSH1 = effectiveHour >= 8 ? item.psJamH1?.[effectiveHour] ?? 0 : 0;
              const psRePercentH1 = totalREH1 > 0 ? (totalPSH1 / totalREH1) * 100 : 0;
              const psReGapH1 = psRePercent - psRePercentH1;
              const comparisonHour = effectiveHour - 2;
              const deviationHour = effectiveHour - 1;
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
                    const reValue = jam <= effectiveHour ? (item.reJam?.[jam] ?? 0) : '';
                    const psValue = jam <= effectiveHour ? (item.psJam?.[jam] ?? 0) : '';
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
                    {effectiveHour < 10 ? '-' : formatCountDelta(reDeviation)}
                  </td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : deltaClass(psDeviation)}`}>
                    {effectiveHour < 10 ? '-' : formatCountDelta(psDeviation)}
                  </td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : deltaClass(psReDeviation)}`}>
                    {effectiveHour < 10 ? '-' : `${psReDeviation > 0 ? '+' : ''}${psReDeviation.toFixed(2)}%`}
                  </td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : (psRePercentH1 >= 85 ? 'text-green-600' : 'text-red-600')}`}>
                    {effectiveHour < 8 ? '-' : psRePercentH1.toFixed(2) + '%'}
                  </td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${isArea2 ? 'text-white' : deltaClass(psReGapH1)}`}>
                    {effectiveHour < 8 ? '-' : `${psReGapH1 > 0 ? '+' : ''}${psReGapH1.toFixed(2)}%`}
                  </td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : (psRePercent >= 85 ? 'text-green-600' : 'text-red-600')}`}>
                    {effectiveHour < 8 ? '-' : psRePercent.toFixed(2) + '%'}
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
      <div data-export-ignore="true" className="mb-0 mt-4 w-full rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800">Ringkasan Pergerakan Order</h3>
          <button
            type="button"
            onClick={copyJamSummary}
            className="shrink-0 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900"
          >
            Salin summary
          </button>
        </div>
        <p className="text-xs leading-5 text-slate-700">
          Pada pukul <span className="font-bold">{String(effectiveHour).padStart(2, '0')}:00</span>, Area 2 mencatat RE{' '}
          <span className="font-bold text-blue-700">{area2RE}</span>, PS{' '}
          <span className="font-bold text-green-700">{area2PS}</span>, PS/RE{' '}
          <span className="font-bold">{area2PSRE.toFixed(2)}%</span>.
          {effectiveHour >= 8 && (
            <> Dibanding H-1 pada jam yang sama, pencapaian kini {psReDifferenceText} dari <span className="font-bold">{area2PSREH1.toFixed(2)}%</span> menjadi <span className="font-bold">{area2PSRE.toFixed(2)}%</span>.</>
          )}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-700">{encouragement}</p>
        {highestBranch && lowestBranch && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-green-200 bg-green-100 px-2.5 py-1 font-semibold text-green-800">
              PS/RE Tertinggi: {highestBranch.branch} ({highestBranch.psRe.toFixed(2)}%, H-1 {highestBranch.psReH1.toFixed(2)}%)
            </span>
            <span className="rounded-full border border-red-200 bg-red-100 px-2.5 py-1 font-semibold text-red-800">
              PS/RE Terendah: {lowestBranch.branch} ({lowestBranch.psRe.toFixed(2)}%, H-1 {lowestBranch.psReH1.toFixed(2)}%)
            </span>
          </div>
        )}
        {copyFeedback && <p className="mt-2 text-xs font-semibold text-green-700">{copyFeedback}</p>}
      </div>
      </div>
    </div>
  );
}