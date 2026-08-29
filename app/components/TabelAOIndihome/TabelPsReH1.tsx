'use client';

import React, { useState, useRef } from 'react';
import { startOfDay, endOfDay, isBefore, isAfter, subDays, format } from 'date-fns';

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
          font-family: Arial, sans-serif; 
          font-size: 12px;
          margin-bottom: 20px;
        }
        h3 {
          font-size: 14px;
          font-weight: bold;
          margin: 15px 0 10px 0;
          font-family: Arial, sans-serif;
        }
        thead { 
          background-color: #1e293b; 
          color: #ffffff; 
        }
        th { 
          border: 1px solid #334155; 
          padding: 10px; 
          text-align: center; 
          font-weight: bold; 
          font-size: 12px;
          color: #ffffff;
          background-color: #1e293b;
        }
        td { 
          border: 1px solid #cbd5e1; 
          padding: 10px; 
          font-size: 11px;
          color: #000000;
        }
        tbody tr:nth-child(odd) { 
          background-color: #f1f5f9; 
        }
        tbody tr:nth-child(even) { 
          background-color: #ffffff; 
        }
        .grand-total {
          background-color: #e2e8f0;
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
            className="mt-2 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition font-bold"
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
