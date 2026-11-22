'use client';

import React, { useState, useRef } from 'react';
import { startOfDay, endOfDay, isBefore, isAfter, subDays, format } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface TabelPsReH1Props {
  filteredData: any[];
  dateFrom: string;
  dateTo: string;
  regionalMapping: any;
  parseDate: (value: any) => Date | null;
  exportSection?: (elementId: string, fileName: string) => void;
}

export default function TabelPsReH1({
  filteredData,
  dateFrom,
  dateTo,
  regionalMapping,
  parseDate,
  exportSection,
}: TabelPsReH1Props) {
  const [copyFeedback, setCopyFeedback] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

  // ============================================
  // HITUNG H-1 RANGE
  // ============================================
  const getH1Range = () => {
    const referenceDate = dateTo ? new Date(dateTo) : new Date();
    const h1Date = subDays(referenceDate, 1);

    return {
      h1DateFrom: startOfDay(h1Date),
      h1DateTo: endOfDay(h1Date),
    };
  };

  // ============================================
  // HITUNG DATA PS/RE H-1
  // ============================================
  const calculatePsReH1Data = () => {
    const { h1DateFrom, h1DateTo } = getH1Range();
    
    const h1DateFromStart = startOfDay(h1DateFrom);
    const h1DateToEnd = endOfDay(h1DateTo);
    
    const h1DateToAt17 = new Date(h1DateTo);
    h1DateToAt17.setHours(17, 0, 0, 0);

    // RE H-1 (00:01 - 17:00) - hanya data DATECREATED H-1 siang hari
    const reH1Before17 = filteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (isBefore(dateCreated, h1DateFromStart)) return false;
      if (isAfter(dateCreated, h1DateToAt17)) return false;

      const hasTimeAfterMidnight =
        dateCreated.getHours() > 0 ||
        dateCreated.getMinutes() > 0 ||
        dateCreated.getSeconds() > 0 ||
        dateCreated.getMilliseconds() > 0;

      return hasTimeAfterMidnight;
    });

    // RE H-1 (full) - semua data DATECREATED H-1 tanpa pembatasan jam
    const reH1Full = filteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (isBefore(dateCreated, h1DateFromStart)) return false;
      if (isAfter(dateCreated, h1DateToEnd)) return false;
      return true;
    });

    // PS H-1 (FULL DAY) - statusdate H-1 + STATUS = COMPWORK
    const psH1Full = filteredData.filter((row: any) => {
      const statusDate = parseDate(row['STATUSDATE']);
      if (!statusDate) return false;
      if (row['STATUS'] !== 'COMPWORK') return false;
      if (isBefore(statusDate, h1DateFromStart)) return false;
      if (isAfter(statusDate, h1DateToEnd)) return false;
      return true;
    });

    // Calculate per regional
    const regionalMap = new Map<string, { reH1Before17: number; reH1Full: number; psH1Full: number }>();

    reH1Before17.forEach((row: any) => {
      const regional = regionalMapping[row['DISTRICT_TIF']] || 'LAINNYA';
      if (!regionalMap.has(regional)) {
        regionalMap.set(regional, { reH1Before17: 0, reH1Full: 0, psH1Full: 0 });
      }
      regionalMap.get(regional)!.reH1Before17++;
    });

    reH1Full.forEach((row: any) => {
      const regional = regionalMapping[row['DISTRICT_TIF']] || 'LAINNYA';
      if (!regionalMap.has(regional)) {
        regionalMap.set(regional, { reH1Before17: 0, reH1Full: 0, psH1Full: 0 });
      }
      regionalMap.get(regional)!.reH1Full++;
    });

    psH1Full.forEach((row: any) => {
      const regional = regionalMapping[row['DISTRICT_TIF']] || 'LAINNYA';
      if (!regionalMap.has(regional)) {
        regionalMap.set(regional, { reH1Before17: 0, reH1Full: 0, psH1Full: 0 });
      }
      regionalMap.get(regional)!.psH1Full++;
    });

    // Hitung akumulasi RE/PS per jam untuk tabel H-1.
    const jamRange = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const calculatePerJam = (rows: any[], isRE: boolean) => {
      const hourly: { [key: number]: number } = {};
      jamRange.forEach((hour) => { hourly[hour] = 0; });

      rows.forEach((row: any) => {
        const date = parseDate(isRE ? row['DATECREATED'] : row['STATUSDATE']);
        if (!date) return;
        for (let hour = 8; hour <= 23; hour++) {
          if (date.getHours() <= hour) {
            hourly[hour]++;
            break;
          }
        }
      });

      const cumulative: { [key: number]: number } = {};
      let total = 0;
      jamRange.forEach((hour) => {
        cumulative[hour] = total + hourly[hour];
        total = cumulative[hour];
      });
      return cumulative;
    };

    const h1PerJamBranchMap = new Map<string, { regional: string; reJam: any; psJam: any }>();
    const h1Branches = new Set<string>();
    reH1Full.forEach((row: any) => h1Branches.add(row['DISTRICT_TIF'] || 'UNKNOWN'));
    psH1Full.forEach((row: any) => h1Branches.add(row['DISTRICT_TIF'] || 'UNKNOWN'));

    h1Branches.forEach((branch) => {
      const reRows = reH1Full.filter((row: any) => (row['DISTRICT_TIF'] || 'UNKNOWN') === branch);
      const psRows = psH1Full.filter((row: any) => (row['DISTRICT_TIF'] || 'UNKNOWN') === branch);
      h1PerJamBranchMap.set(branch, {
        regional: regionalMapping[branch] || 'LAINNYA',
        reJam: calculatePerJam(reRows, true),
        psJam: calculatePerJam(psRows, false),
      });
    });

    // Calculate per branch
    const branchMap = new Map<string, { reH1Before17: number; reH1Full: number; psH1Full: number }>();

    reH1Before17.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      if (!branchMap.has(branch)) {
        branchMap.set(branch, { reH1Before17: 0, reH1Full: 0, psH1Full: 0 });
      }
      branchMap.get(branch)!.reH1Before17++;
    });

    reH1Full.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      if (!branchMap.has(branch)) {
        branchMap.set(branch, { reH1Before17: 0, reH1Full: 0, psH1Full: 0 });
      }
      branchMap.get(branch)!.reH1Full++;
    });

    psH1Full.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      if (!branchMap.has(branch)) {
        branchMap.set(branch, { reH1Before17: 0, reH1Full: 0, psH1Full: 0 });
      }
      branchMap.get(branch)!.psH1Full++;
    });

    // Build regional data
    const regionalOrder = ['BANTEN', 'EASTERN JABOTABEK', 'JAKARTA', 'JAWA BARAT'];
    const regionalArray: any[] = [];
    let grandTotalRe00To17 = 0;
    let grandTotalReFullDay = 0;
    let grandTotalPsFullDay = 0;

    regionalOrder.forEach((regional) => {
      const data = regionalMap.get(regional);
      if (!data) return;

      const psReH1 = data.reH1Full > 0 ? (data.psH1Full / data.reH1Full) * 100 : 0;

      regionalArray.push({
        regional,
        reH1Before17: data.reH1Before17,
        reH1Full: data.reH1Full,
        psH1Full: data.psH1Full,
        psReH1,
      });

      grandTotalRe00To17 += data.reH1Before17;
      grandTotalReFullDay += data.reH1Full;
      grandTotalPsFullDay += data.psH1Full;
    });

    const grandTotalPsReH1 = grandTotalReFullDay > 0 ? (grandTotalPsFullDay / grandTotalReFullDay) * 100 : 0;

    // Build branch data sorted by psReH1 descending
    const branchArray: any[] = [];
    let branchGrandTotalRe00To17 = 0;
    let branchGrandTotalReFullDay = 0;
    let branchGrandTotalPsFullDay = 0;

    branchMap.forEach((data, branch) => {
      const psReH1 = data.reH1Full > 0 ? (data.psH1Full / data.reH1Full) * 100 : 0;

      branchArray.push({
        branch,
        reH1Before17: data.reH1Before17,
        reH1Full: data.reH1Full,
        psH1Full: data.psH1Full,
        psReH1,
      });

      branchGrandTotalRe00To17 += data.reH1Before17;
      branchGrandTotalReFullDay += data.reH1Full;
      branchGrandTotalPsFullDay += data.psH1Full;
    });

    // Sort by psReH1 descending
    branchArray.sort((a, b) => b.psReH1 - a.psReH1);

    const branchGrandTotalPsReH1 = branchGrandTotalReFullDay > 0 ? (branchGrandTotalPsFullDay / branchGrandTotalReFullDay) * 100 : 0;

    const h1PerJamRows = Array.from(h1PerJamBranchMap.entries()).map(([branch, values]) => ({
      branch,
      ...values,
    })).sort((a, b) => {
      const regA = regionalOrder.indexOf(a.regional);
      const regB = regionalOrder.indexOf(b.regional);
      if (regA !== regB) return regA - regB;
      return a.branch.localeCompare(b.branch);
    });

    const h1GrandRE: any = {};
    const h1GrandPS: any = {};
    jamRange.forEach((hour) => {
      h1GrandRE[hour] = 0;
      h1GrandPS[hour] = 0;
    });
    h1PerJamRows.forEach((row) => {
      jamRange.forEach((hour) => {
        h1GrandRE[hour] += row.reJam[hour] || 0;
        h1GrandPS[hour] += row.psJam[hour] || 0;
      });
    });

    return {
      h1DateTo: format(h1DateTo, 'yyyy-MM-dd'),
      regionalArray,
      branchArray,
      grandTotalRe00To17,
      grandTotalReFullDay,
      grandTotalPsFullDay,
      grandTotalPsReH1,
      branchGrandTotalRe00To17,
      branchGrandTotalReFullDay,
      branchGrandTotalPsFullDay,
      branchGrandTotalPsReH1,
      h1PerJamRows,
      h1GrandRE,
      h1GrandPS,
      jamRange,
    };
  };

  const data = calculatePsReH1Data();

  if (filteredData.length === 0 || data.branchArray.length === 0) {
    return null;
  }

  // ============================================
  // FUNGSI COPY TO CLIPBOARD
  // ============================================
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('✓ Copied!');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      setCopyFeedback('✗ Copy failed');
    }
  };

  // ============================================
  // FUNGSI GENERATE SUMMARY REPORT
  // ============================================
  const generateSummaryReport = () => {
    let report = 'REPORT PS/RE INDIHOME H-1\n\n';
    
    data.branchArray.forEach((item: any, idx: number) => {
      report += `${idx + 1} . ${item.branch}  /  ${item.psReH1.toFixed(2)}% \n`;
    });

    report += `# . AREA 2  /  ${data.branchGrandTotalPsReH1.toFixed(2)}%`;

    return report;
  };

  // ============================================
  // FUNGSI EXPORT TABLE
  // ============================================
  const exportTablePng = async () => {
    if (!tableRef.current) return;

    try {
      const html2canvas = (await import('html2canvas')).default;

      const clonedDiv = tableRef.current.cloneNode(true) as HTMLDivElement;
      clonedDiv.querySelectorAll('[data-export-ignore="true"]').forEach((el) => el.remove());
      
      const styleSheet = document.createElement('style');
      styleSheet.textContent = `
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-family: var(--font-ibm-plex-sans), sans-serif;
          font-size: 12px;
          margin-bottom: 20px;
        }
        h3 {
          font-size: 14px;
          font-weight: bold;
          margin: 15px 0 10px 0;
          font-family: var(--font-ibm-plex-sans), sans-serif;
        }
        thead { 
          background-color: #102b49;
          color: #ffffff; 
        }
        th { 
          border: 1px solid #28527e;
          padding: 10px; 
          text-align: center; 
          font-weight: bold; 
          font-size: 12px;
          color: #ffffff;
          background-color: #102b49;
        }
        td { 
          border: 1px solid #c8d9ea;
          padding: 10px; 
          font-size: 11px;
          color: #28527e;
        }
        tbody tr:nth-child(odd) { 
          background-color: #f1f7ff;
        }
        tbody tr:nth-child(even) { 
          background-color: #ffffff; 
        }
        .grand-total {
          background-color: #e4efff;
          font-weight: bold;
        }
      `;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.background = 'white';
      tempContainer.style.padding = '20px';
      tempContainer.style.width = '900px';
      
      clonedDiv.querySelectorAll('*').forEach((el) => {
        el.removeAttribute('class');
      });
      
      tempContainer.appendChild(styleSheet);
      tempContainer.appendChild(clonedDiv);
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      document.body.removeChild(tempContainer);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `PS_RE_H1_${data.h1DateTo}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export gagal, silakan coba lagi');
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto mb-6 relative" ref={tableRef}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-bold text-slate-800">📋 Fulfillment Endstate PS/RE H-1</h2>
      </div>

      {/* TABEL PS/RE PER JAM H-1 */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">📋 Monitoring Pergerakan Order per-Jam H-1 ({data.h1DateTo})</h3>
        <div className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="h-72 min-h-72">
            <Line
              data={{
                labels: data.jamRange.map((hour: number) => `${String(hour).padStart(2, '0')}:00`),
                datasets: [
                  { label: 'RE', data: data.jamRange.map((hour: number) => data.h1GrandRE[hour]), borderColor: '#2563eb', backgroundColor: '#2563eb', tension: 0.25 },
                  { label: 'PS', data: data.jamRange.map((hour: number) => data.h1GrandPS[hour]), borderColor: '#16a34a', backgroundColor: '#16a34a', tension: 0.25 },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' as const }, tooltip: { mode: 'index' as const, intersect: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
              }}
            />
          </div>
        </div>
        <table className="w-max min-w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th rowSpan={2} className="border border-slate-600 p-1 text-left">REGIONAL</th>
              <th rowSpan={2} className="border border-slate-600 p-1 text-left">BRANCH</th>
              {data.jamRange.map((hour: number) => (
                <th key={hour} colSpan={2} className="border border-slate-600 p-1 text-center bg-slate-700">{String(hour).padStart(2, '0')}:00</th>
              ))}
              <th rowSpan={2} className="border border-slate-600 p-1 text-center bg-slate-700">PS/RE</th>
            </tr>
            <tr className="bg-slate-600 text-white">
              {data.jamRange.map((hour: number) => (
                <React.Fragment key={`h1-header-${hour}`}>
                  <th className="border border-slate-500 p-0.5 text-center">RE</th>
                  <th className="border border-slate-500 p-0.5 text-center">PS</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const regionalOrder = ['BANTEN', 'EASTERN JABOTABEK', 'JAKARTA', 'JAWA BARAT'];
              const subtotalRows: any[] = [];
              regionalOrder.forEach((regional) => {
                const rows = data.h1PerJamRows.filter((row: any) => row.regional === regional);
                if (rows.length === 0) return;
                rows.forEach((row: any) => subtotalRows.push(row));
                const reSubtotal: any = {};
                const psSubtotal: any = {};
                data.jamRange.forEach((hour: number) => {
                  reSubtotal[hour] = rows.reduce((sum: number, row: any) => sum + (row.reJam[hour] || 0), 0);
                  psSubtotal[hour] = rows.reduce((sum: number, row: any) => sum + (row.psJam[hour] || 0), 0);
                });
                subtotalRows.push({ branch: 'SUB TOTAL', regional, reJam: reSubtotal, psJam: psSubtotal, isSubtotal: true });
              });
              subtotalRows.push({ branch: 'AREA 2', regional: 'GRAND TOTAL', reJam: data.h1GrandRE, psJam: data.h1GrandPS, isArea2: true });

              let lastRegional = '';
              let regionalCount = 0;
              return subtotalRows.map((row: any, index: number) => {
                if (!row.isArea2 && row.regional !== lastRegional) {
                  lastRegional = row.regional;
                  regionalCount = subtotalRows.filter((candidate: any) => !candidate.isArea2 && candidate.regional === row.regional).length;
                }
                const reEnd = row.reJam?.[23] || 0;
                const psEnd = row.psJam?.[23] || 0;
                const psRe = reEnd > 0 ? (psEnd / reEnd) * 100 : 0;
                const showRegional = !row.isArea2 && row.regional !== '' && subtotalRows[index - 1]?.regional !== row.regional;
                return (
                  <tr key={`${row.regional}-${row.branch}-${index}`} className={row.isArea2 ? 'bg-slate-800 text-white' : row.isSubtotal ? 'bg-blue-100' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    {row.isArea2 ? (
                      <td colSpan={2} className="border border-slate-300 p-1 font-bold text-center text-white">AREA 2</td>
                    ) : (
                      <>
                        {showRegional && <td rowSpan={regionalCount} className="border border-slate-300 p-1 font-bold">{row.regional}</td>}
                        <td className="border border-slate-300 p-1 font-semibold">{row.isSubtotal ? 'SUB TOTAL' : row.branch}</td>
                      </>
                    )}
                    {data.jamRange.map((hour: number) => (
                      <React.Fragment key={`${index}-${hour}`}>
                        <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${row.isArea2 ? 'text-white' : 'text-blue-600'}`}>{row.reJam?.[hour] ?? 0}</td>
                        <td className={`border border-slate-300 p-1 text-center font-mono font-semibold ${row.isArea2 ? 'text-white' : 'text-green-600'}`}>{row.psJam?.[hour] ?? 0}</td>
                      </React.Fragment>
                    ))}
                    <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${row.isArea2 ? 'text-white' : psRe >= 85 ? 'text-green-600' : 'text-red-600'}`}>{psRe.toFixed(2)}%</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {/* REGIONAL TABLE */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">📋 Regional TA</h3>
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th rowSpan={2} className="border border-slate-600 p-1 text-center font-bold">NO</th>
              <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold">REGIONAL</th>
              <th colSpan={3} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE (RE H-1 00:01 - 17:00)</th>
              <th colSpan={3} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE H-1 (85%)</th>
            </tr>
            <tr className="bg-slate-600 text-white">
              <th className="border border-slate-500 p-0.5 text-center font-semibold">RE H-1</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">PS H-1 (FULL DAY)</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">RE H-1</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">PS H-1</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE</th>
            </tr>
          </thead>
          <tbody>
            {data.regionalArray.map((item: any, idx: number) => {
              const rowColor = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              const psReH1Before17 = item.reH1Before17 > 0 ? (item.psH1Full / item.reH1Before17) * 100 : 0;

              return (
                <tr key={idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                  <td className="border border-slate-300 p-1 text-center font-mono font-bold text-indigo-700 bg-indigo-50">{idx + 1}</td>
                  <td className="border border-slate-300 p-1 font-bold text-blue-700">{item.regional}</td>
                  <td className="border border-slate-300 p-1 text-center font-mono text-black">{item.reH1Before17}</td>
                  <td className="border border-slate-300 p-1 text-center font-mono text-black">{item.psH1Full}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${psReH1Before17 >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                    {psReH1Before17.toFixed(2)}%
                  </td>
                  <td className="border border-slate-300 p-1 text-center font-mono text-black">{item.reH1Full}</td>
                  <td className="border border-slate-300 p-1 text-center font-mono text-black">{item.psH1Full}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${item.psReH1 >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.psReH1.toFixed(2)}%
                  </td>
                </tr>
              );
            })}

            <tr className="bg-slate-200 font-bold">
              <td className="border border-slate-300 p-1 text-center"></td>
              <td className="border border-slate-300 p-1 text-slate-800">Grand Total</td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{data.grandTotalRe00To17}</td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{data.grandTotalPsFullDay}</td>
              <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${data.grandTotalPsFullDay / data.grandTotalRe00To17 * 100 >= 85 ? 'text-green-700' : 'text-red-700'}`}>
                {(data.grandTotalRe00To17 > 0 ? (data.grandTotalPsFullDay / data.grandTotalRe00To17) * 100 : 0).toFixed(2)}%
              </td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{data.grandTotalReFullDay}</td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{data.grandTotalPsFullDay}</td>
              <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${data.grandTotalPsReH1 >= 85 ? 'text-green-700' : 'text-red-700'}`}>
                {data.grandTotalPsReH1.toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* BRANCH TABLE */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">📋 Branch TA</h3>
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th rowSpan={2} className="border border-slate-600 p-1 text-center font-bold">NO</th>
              <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold">BRANCH</th>
              <th colSpan={3} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE (RE H-1 00:01 - 17:00)</th>
              <th colSpan={3} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE H-1 (85%)</th>
            </tr>
            <tr className="bg-slate-600 text-white">
              <th className="border border-slate-500 p-0.5 text-center font-semibold">RE H-1</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">PS H-1 (FULL DAY)</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">RE H-1</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">PS H-1</th>
              <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE</th>
            </tr>
          </thead>
          <tbody>
            {data.branchArray.map((item: any, idx: number) => {
              const rowColor = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
              const psReH1Before17 = item.reH1Before17 > 0 ? (item.psH1Full / item.reH1Before17) * 100 : 0;

              return (
                <tr key={idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                  <td className="border border-slate-300 p-1 text-center font-mono font-bold text-indigo-700 bg-indigo-50">{idx + 1}</td>
                  <td className="border border-slate-300 p-1 font-bold text-blue-700">{item.branch}</td>
                  <td className="border border-slate-300 p-1 text-center font-mono text-black">{item.reH1Before17}</td>
                  <td className="border border-slate-300 p-1 text-center font-mono text-black">{item.psH1Full}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${psReH1Before17 >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                    {psReH1Before17.toFixed(2)}%
                  </td>
                  <td className="border border-slate-300 p-1 text-center font-mono text-black">{item.reH1Full}</td>
                  <td className="border border-slate-300 p-1 text-center font-mono text-black">{item.psH1Full}</td>
                  <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${item.psReH1 >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.psReH1.toFixed(2)}%
                  </td>
                </tr>
              );
            })}

            <tr className="bg-slate-200 font-bold">
              <td className="border border-slate-300 p-1 text-center"></td>
              <td className="border border-slate-300 p-1 text-slate-800">Grand Total</td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{data.branchGrandTotalRe00To17}</td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{data.branchGrandTotalPsFullDay}</td>
              <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${data.branchGrandTotalRe00To17 > 0 && data.branchGrandTotalPsFullDay / data.branchGrandTotalRe00To17 * 100 >= 85 ? 'text-green-700' : 'text-red-700'}`}>
                {(data.branchGrandTotalRe00To17 > 0 ? (data.branchGrandTotalPsFullDay / data.branchGrandTotalRe00To17) * 100 : 0).toFixed(2)}%
              </td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{data.branchGrandTotalReFullDay}</td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{data.branchGrandTotalPsFullDay}</td>
              <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${data.branchGrandTotalPsReH1 >= 85 ? 'text-green-700' : 'text-red-700'}`}>
                {data.branchGrandTotalPsReH1.toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SUMMARY SECTION */}
      <div data-export-ignore="true" className="bg-slate-50 p-4 rounded-lg mt-4 border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 mb-3">📋 Report Summary</h3>
        
        <div className="p-3 bg-white border border-slate-300 rounded">
          <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{generateSummaryReport()}</p>
          <button
            onClick={() => copyToClipboard(generateSummaryReport())}
            className="report-action report-action--copy mt-2"
          >
            📋 Copy Report
          </button>
        </div>

        {copyFeedback && (
          <div className="mt-2 text-xs text-center text-green-600 font-semibold">{copyFeedback}</div>
        )}
      </div>
    </div>
  );
}
