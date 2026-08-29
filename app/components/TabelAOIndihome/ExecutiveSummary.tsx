'use client';

import React, { useState } from 'react';
import { format, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

interface ExecutiveSummaryProps {
  filteredData: any[];
  dateFrom: string;
  dateTo: string;
  statusDateFrom: string;
  statusDateTo: string;
  regionalMapping: any;
  parseDate: (value: any) => Date | null;
  exportSection?: (elementId: string, fileName: string) => void;
}

export default function ExecutiveSummary({
  filteredData,
  dateFrom,
  dateTo,
  statusDateFrom,
  statusDateTo,
  regionalMapping,
  parseDate,
  exportSection,
}: ExecutiveSummaryProps) {
  // ============================================
  // HITUNG DATA EXECUTIVE SUMMARY
  // ============================================
  const calculateExecutiveSummary = () => {
    const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
    const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;

    const reSummaryData = filteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (fromDate && isBefore(dateCreated, fromDate)) return false;
      if (toDate && isAfter(dateCreated, toDate)) return false;
      return true;
    });

    const statusFrom = statusDateFrom ? startOfDay(new Date(statusDateFrom)) : null;
    const statusTo = statusDateTo ? endOfDay(new Date(statusDateTo)) : null;

    const psSummaryData = filteredData.filter((row: any) => {
      const statusDate = parseDate(row['STATUSDATE']);
      if (!statusDate) return false;
      if (row['STATUS'] !== 'COMPWORK') return false;
      if (statusFrom && isBefore(statusDate, statusFrom)) return false;
      if (statusTo && isAfter(statusDate, statusTo)) return false;
      return true;
    });

    const daysInFilter = dateFrom && dateTo 
      ? Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 1;

    // Regional
    const regionalOrder = ['EASTERN JABOTABEK', 'JAWA BARAT', 'JAKARTA', 'BANTEN'];
    const regionalData: any[] = [];

    regionalOrder.forEach((region) => {
      const reCount = reSummaryData.filter((row: any) => regionalMapping[row['DISTRICT_TIF']] === region).length;
      const psCount = psSummaryData.filter((row: any) => regionalMapping[row['DISTRICT_TIF']] === region).length;
      const psRePercent = reCount > 0 ? (psCount / reCount) * 100 : 0;
      
      regionalData.push({
        region,
        reMTD: reCount,
        psMTD: psCount,
        psRePercent,
        avgRE: Math.round(reCount / daysInFilter),
        avgPS: Math.round(psCount / daysInFilter),
      });
    });

    regionalData.sort((a, b) => b.psRePercent - a.psRePercent);

    const grandTotalRE = regionalData.reduce((sum, item) => sum + item.reMTD, 0);
    const grandTotalPS = regionalData.reduce((sum, item) => sum + item.psMTD, 0);
    const grandTotalPsRe = grandTotalRE > 0 ? (grandTotalPS / grandTotalRE) * 100 : 0;
    const grandTotalAvgRE = Math.round(grandTotalRE / daysInFilter);
    const grandTotalAvgPS = Math.round(grandTotalPS / daysInFilter);

    // Daily Data
    const dailyMap = new Map<string, { re: number, ps: number }>();

    reSummaryData.forEach((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return;
      const dateKey = format(dateCreated, 'yyyy-MM-dd');
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { re: 0, ps: 0 });
      }
      dailyMap.get(dateKey)!.re++;
    });

    psSummaryData.forEach((row: any) => {
      const statusDate = parseDate(row['STATUSDATE']);
      if (!statusDate) return;
      const dateKey = format(statusDate, 'yyyy-MM-dd');
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { re: 0, ps: 0 });
      }
      dailyMap.get(dateKey)!.ps++;
    });

    const sortedDates = Array.from(dailyMap.keys()).sort();
    const dailyData = sortedDates.map(dateKey => {
      const data = dailyMap.get(dateKey)!;
      const psRePercent = data.re > 0 ? (data.ps / data.re) * 100 : 0;
      return {
        date: new Date(dateKey),
        re: data.re,
        ps: data.ps,
        psRePercent,
      };
    });

    // Branch
    const branchSummaryMap = new Map<string, { reCount: number, psCount: number }>();

    reSummaryData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      if (!branchSummaryMap.has(branch)) {
        branchSummaryMap.set(branch, { reCount: 0, psCount: 0 });
      }
      branchSummaryMap.get(branch)!.reCount++;
    });

    psSummaryData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      if (!branchSummaryMap.has(branch)) {
        branchSummaryMap.set(branch, { reCount: 0, psCount: 0 });
      }
      branchSummaryMap.get(branch)!.psCount++;
    });

    const branchData: any[] = [];
    branchSummaryMap.forEach((value, branch) => {
      const psRePercent = value.reCount > 0 ? (value.psCount / value.reCount) * 100 : 0;
      branchData.push({
        branch,
        reMTD: value.reCount,
        psMTD: value.psCount,
        psRePercent,
        avgRE: Math.round(value.reCount / daysInFilter),
        avgPS: Math.round(value.psCount / daysInFilter),
      });
    });

    branchData.sort((a, b) => b.psRePercent - a.psRePercent);

    const branchGrandTotalRE = branchData.reduce((sum, item) => sum + item.reMTD, 0);
    const branchGrandTotalPS = branchData.reduce((sum, item) => sum + item.psMTD, 0);
    const branchGrandTotalPsRe = branchGrandTotalRE > 0 ? (branchGrandTotalPS / branchGrandTotalRE) * 100 : 0;
    const branchGrandTotalAvgRE = Math.round(branchGrandTotalRE / daysInFilter);
    const branchGrandTotalAvgPS = Math.round(branchGrandTotalPS / daysInFilter);

    return {
      regionalData,
      branchData,
      dailyData,
      grandTotalRE,
      grandTotalPS,
      grandTotalPsRe,
      grandTotalAvgRE,
      grandTotalAvgPS,
      branchGrandTotalRE,
      branchGrandTotalPS,
      branchGrandTotalPsRe,
      branchGrandTotalAvgRE,
      branchGrandTotalAvgPS,
      daysInFilter,
    };
  };

  const summary = calculateExecutiveSummary();

  const [copyFeedback, setCopyFeedback] = useState('');

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
  // FUNGSI GENERATE PS/RE REPORT
  // ============================================
  const generatePsReReport = () => {
    const currentDate = new Date();
    const currentMonth = format(currentDate, 'MMMM yyyy').charAt(0).toUpperCase() + format(currentDate, 'MMMM yyyy').slice(1);
    
    let report = `Report PS/RE Indihome Mtd ${currentMonth}\n`;
    report += '===================\n';
    report += 'NO | BRANCH | PS/RE\n';
    
    // Branch data sorted by psRePercent descending
    const sortedBranches = [...summary.branchData].sort((a, b) => b.psRePercent - a.psRePercent);
    
    sortedBranches.forEach((item: any, idx: number) => {
      const status = item.psRePercent >= 85 ? '✅' : '❌';
      report += `${idx + 1} | ${item.branch} | ${item.psRePercent.toFixed(2)}% | ${status}\n`;
    });
    
    // AREA 2 total
    const area2Status = summary.branchGrandTotalPsRe >= 85 ? '✅' : '❌';
    report += `# | AREA 2 | ${summary.branchGrandTotalPsRe.toFixed(2)}% | ${area2Status}`;
    
    return report;
  };

  if (filteredData.length === 0 || summary.branchData.length === 0) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6 relative">
      {/* Tombol Export PNG */}
      <div className="absolute top-2 right-2">
        {exportSection && (
          <button
            onClick={() => exportSection('executive-summary', 'Executive_Summary')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        )}
      </div>
      
      <h2 className="text-base font-bold text-slate-800 mb-3">📊 Executive Summary</h2>
      
      {/* GRAFIK BAR RE & PS */}
      <div className="mb-4 w-full">
        <h3 className="text-xs font-semibold text-slate-600 mb-2 text-center">📈 RE & PS per Hari</h3>
        <div className="h-48 w-full">
          <Bar
            data={{
              labels: summary.dailyData.map((item: any) => format(item.date, 'dd/MM')),
              datasets: [
                {
                  label: 'RE',
                  data: summary.dailyData.map((item: any) => item.re),
                  backgroundColor: 'rgba(59, 130, 246, 0.6)',
                },
                {
                  label: 'PS',
                  data: summary.dailyData.map((item: any) => item.ps),
                  backgroundColor: 'rgba(34, 197, 94, 0.6)',
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 8 } } } },
              scales: {
                y: { beginAtZero: true, ticks: { font: { size: 8 } } },
                x: { ticks: { maxRotation: 45, font: { size: 8 } } },
              },
            }}
          />
        </div>
      </div>

      {/* GRAFIK LINE PS/RE % */}
      <div className="mb-4 w-full">
        <h3 className="text-xs font-semibold text-slate-600 mb-2 text-center">📈 PS/RE % per Hari</h3>
        <div className="h-48 w-full">
          <Line
            data={{
              labels: summary.dailyData.map((item: any) => format(item.date, 'dd/MM')),
              datasets: [
                {
                  label: 'PS/RE %',
                  data: summary.dailyData.map((item: any) => item.psRePercent),
                  borderColor: 'rgb(239, 68, 68)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderWidth: 2,
                  pointRadius: 3,
                  tension: 0.3,
                  fill: true,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'top', labels: { boxWidth: 10, font: { size: 8 } } } },
              scales: {
                y: { beginAtZero: true, max: 100, ticks: { callback: (value) => value + '%', font: { size: 8 } } },
                x: { ticks: { maxRotation: 45, font: { size: 8 } } },
              },
              layout: { padding: { bottom: 20 } },
            }}
          />
        </div>
      </div>

      {/* TABEL REGIONAL */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">📋 Regional TA</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="border border-slate-600 p-1 text-left font-bold">Region</th>
                <th className="border border-slate-600 p-1 text-right font-bold">RE MTD</th>
                <th className="border border-slate-600 p-1 text-right font-bold">PS MTD</th>
                <th className="border border-slate-600 p-1 text-right font-bold">PS/RE</th>
                <th className="border border-slate-600 p-1 text-right font-bold">AVG RE</th>
                <th className="border border-slate-600 p-1 text-right font-bold">AVG PS</th>
              </tr>
            </thead>
            <tbody>
              {summary.regionalData.map((item: any, idx: number) => {
                const rowColor = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                const isOnTarget = item.psRePercent >= 85;
                return (
                  <tr key={idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                    <td className="border border-slate-300 p-1 font-bold text-blue-700">{item.region}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-blue-600">{item.reMTD.toLocaleString()}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-green-600">{item.psMTD.toLocaleString()}</td>
                    <td className={`border border-slate-300 p-1 text-right font-mono font-bold ${isOnTarget ? 'text-green-600' : 'text-red-600'}`}>
                      {item.psRePercent.toFixed(2)}%
                    </td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-blue-600">{item.avgRE.toLocaleString()}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-green-600">{item.avgPS.toLocaleString()}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-200 font-bold">
                <td className="border border-slate-300 p-1 text-blue-800">Grand Total</td>
                <td className="border border-slate-300 p-1 text-right font-mono text-blue-700">{summary.grandTotalRE.toLocaleString()}</td>
                <td className="border border-slate-300 p-1 text-right font-mono text-green-700">{summary.grandTotalPS.toLocaleString()}</td>
                <td className={`border border-slate-300 p-1 text-right font-mono ${summary.grandTotalPsRe >= 85 ? 'text-green-700' : 'text-red-700'}`}>
                  {summary.grandTotalPsRe.toFixed(2)}%
                </td>
                <td className="border border-slate-300 p-1 text-right font-mono text-blue-700">{summary.grandTotalAvgRE.toLocaleString()}</td>
                <td className="border border-slate-300 p-1 text-right font-mono text-green-700">{summary.grandTotalAvgPS.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* TABEL BRANCH */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">📋 Branch TA</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="border border-slate-600 p-1 text-center font-bold">No</th>
                <th className="border border-slate-600 p-1 text-left font-bold">BRANCH</th>
                <th className="border border-slate-600 p-1 text-right font-bold">RE MTD</th>
                <th className="border border-slate-600 p-1 text-right font-bold">PS MTD</th>
                <th className="border border-slate-600 p-1 text-right font-bold">PS/RE</th>
                <th className="border border-slate-600 p-1 text-left font-bold">AVG RE</th>
                <th className="border border-slate-600 p-1 text-left font-bold">AVG PS</th>
              </tr>
            </thead>
            <tbody>
              {summary.branchData.map((item: any, idx: number) => {
                const rowColor = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                const isOnTarget = item.psRePercent >= 85;
                
                const avgREPercent = summary.branchGrandTotalAvgRE > 0 
                  ? (item.avgRE / summary.branchGrandTotalAvgRE) * 100 
                  : 0;
                const avgPSPercent = summary.branchGrandTotalAvgPS > 0 
                  ? (item.avgPS / summary.branchGrandTotalAvgPS) * 100 
                  : 0;
                
                return (
                  <tr key={idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                    <td className="border border-slate-300 p-1 text-center text-slate-500">{idx + 1}</td>
                    <td className="border border-slate-300 p-1 font-bold text-blue-700">{item.branch}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-blue-600">{item.reMTD.toLocaleString()}</td>
                    <td className="border border-slate-300 p-1 text-right font-mono font-semibold text-green-600">{item.psMTD.toLocaleString()}</td>
                    <td className={`border border-slate-300 p-1 text-right font-mono font-bold ${isOnTarget ? 'text-green-600' : 'text-red-600'}`}>
                      {item.psRePercent.toFixed(2)}%
                    </td>
                    
                    {/* AVG RE - progress bar */}
                    <td className="border border-slate-300 p-1">
                      <div className="flex items-center gap-1 min-w-[80px]">
                        <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(avgREPercent, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-blue-600 w-10 text-right">
                          {item.avgRE}
                        </span>
                      </div>
                    </td>
                    
                    {/* AVG PS - progress bar */}
                    <td className="border border-slate-300 p-1">
                      <div className="flex items-center gap-1 min-w-[80px]">
                        <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(avgPSPercent, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-green-600 w-10 text-right">
                          {item.avgPS}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              <tr className="bg-slate-200 font-bold">
                <td className="border border-slate-300 p-1 text-center"></td>
                <td className="border border-slate-300 p-1 text-blue-800">Grand Total</td>
                <td className="border border-slate-300 p-1 text-right font-mono text-blue-700">{summary.branchGrandTotalRE.toLocaleString()}</td>
                <td className="border border-slate-300 p-1 text-right font-mono text-green-700">{summary.branchGrandTotalPS.toLocaleString()}</td>
                <td className={`border border-slate-300 p-1 text-right font-mono ${summary.branchGrandTotalPsRe >= 85 ? 'text-green-700' : 'text-red-700'}`}>
                  {summary.branchGrandTotalPsRe.toFixed(2)}%
                </td>
                <td className="border border-slate-300 p-1 text-right font-mono text-blue-700">{summary.branchGrandTotalAvgRE.toLocaleString()}</td>
                <td className="border border-slate-300 p-1 text-right font-mono text-green-700">{summary.branchGrandTotalAvgPS.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SUMMARY SECTION - PS/RE REPORT */}
      <div data-export-ignore="true" className="bg-slate-50 p-4 rounded-lg mt-4 border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 mb-3">📋 Report Summary</h3>
        
        <div className="p-3 bg-white border border-slate-300 rounded">
          <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{generatePsReReport()}</p>
          <button
            onClick={() => copyToClipboard(generatePsReReport())}
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