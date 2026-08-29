'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, startOfDay, endOfDay, isBefore, isAfter, isSameDay, isSameMonth } from 'date-fns';
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

// IMPORT DARI CONSTANTS & UTILS
import { regionalMapping, regionalOrder } from '@/constants';
import { parseDate } from '@/utils/date';

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

// ============================================
// TYPES
// ============================================
interface PDAProps {
  data: any[];
  filteredData: any[];
  setData: (data: any[]) => void;
  setFilteredData: (data: any[]) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processData: () => void;
  exportToPNG: () => void;
}

// ============================================
// KOMPONEN UTAMA
// ============================================
export default function TabelPDAIndihome({
  data,
  filteredData,
  setData,
  setFilteredData,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  handleFileUpload,
  processData,
  exportToPNG,
}: PDAProps) {
  const safeFilteredData = filteredData || [];
  const [statusDateFrom, setStatusDateFrom] = useState('');
  const [statusDateTo, setStatusDateTo] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const today = new Date();
  const currentHour = today.getHours();

  // ============================================
  // SET DEFAULT DATE
  // ============================================
  useEffect(() => {
    const now = new Date();
    const firstDay = startOfMonth(now);
    setDateFrom(format(firstDay, 'yyyy-MM-dd'));
    setDateTo(format(now, 'yyyy-MM-dd'));
    setStatusDateFrom(format(firstDay, 'yyyy-MM-dd'));
    setStatusDateTo(format(now, 'yyyy-MM-dd'));
  }, []);

  // ============================================
  // FUNGSI DOWNLOAD CSV
  // ============================================
  const downloadData = (data: any[], label: string) => {
    if (data.length === 0) {
      alert(`⚠️ Tidak ada data untuk ${label}`);
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(h => `"${row[h] || ''}"`);
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${label}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  // ============================================
  // FUNGSI GET DATA PER METRIC (UNTUK DOWNLOAD)
  // ============================================
  const getDataForMetric = (type: string) => {
    switch (type) {
      case 'RE': return safeFilteredData;
      case 'PS': return safeFilteredData.filter((row: any) => row['STATUS'] === 'COMPWORK');
      case 'CANCEL': return safeFilteredData.filter((row: any) => row['STATUS'] === 'CANCLWORK');
      case 'KENDALA_TEKNIK':
        return safeFilteredData.filter(
          (row: any) =>
            row['STATUS'] === 'WORKFAIL' &&
            (row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIK' || row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIS')
        );
      case 'KENDALA_PELANGGAN':
        return safeFilteredData.filter(
          (row: any) => row['STATUS'] === 'WORKFAIL' && row['ERRORCODE_AKHIR'] === 'KENDALA PELANGGAN'
        );
      case 'KENDALA_LAINNYA':
        return safeFilteredData.filter(
          (row: any) => row['STATUS'] === 'WORKFAIL' && row['ERRORCODE_AKHIR'] === 'KENDALA LAINNYA'
        );
      default:
        return [];
    }
  };

  // ============================================
  // EXPORT PNG PER SECTION
  // ============================================
  const exportSection = async (elementId: string, fileName: string) => {
    try {
      const domtoimage = (await import('dom-to-image')).default;
      const element = document.getElementById(elementId);
      if (!element) {
        alert('❌ Elemen tidak ditemukan!');
        return;
      }

      const hiddenNodes = Array.from(element.querySelectorAll('[data-export-ignore="true"]')) as HTMLElement[];
      const originalStates = hiddenNodes.map((node) => ({
        node,
        display: node.style.display,
        visibility: node.style.visibility,
      }));

      originalStates.forEach(({ node }) => {
        node.style.display = 'none';
        node.style.visibility = 'hidden';
      });

      const originalOverflow = element.style.overflow;
      const originalWidth = element.style.width;
      const originalTransform = element.style.transform;

      element.style.overflow = 'visible';
      element.style.width = 'auto';
      element.style.transform = 'scale(1)';
      element.style.transformOrigin = 'top left';

      const dataUrl = await domtoimage.toPng(element, {
        quality: 1,
        bgcolor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          overflow: 'visible',
          minWidth: 'max-content',
          width: 'auto',
        },
      });

      element.style.overflow = originalOverflow;
      element.style.width = originalWidth;
      element.style.transform = originalTransform;

      originalStates.forEach(({ node, display, visibility }) => {
        node.style.display = display;
        node.style.visibility = visibility;
      });

      const link = document.createElement('a');
      link.download = `${fileName}_${format(new Date(), 'yyyyMMdd')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error export PNG:', error);
      alert('❌ Gagal mengexport gambar. Coba lagi!');
    }
  };

  // ============================================
  // COPY TO CLIPBOARD
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
  // GENERATE REPORT SUMMARY (LENGKAP KAYAK AO)
  // ============================================
  const generateSummaryReport = (area2Row: any, tableData: any[]) => {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    // Header Summary
    const headerSummary = `Posisi Jam ${timeStr}, PS HI : ${area2Row.psHI}, Inprogress : ${area2Row.totalInprogress}, dan Order PI : ${area2Row.totalOrderPI}`;
    
    // Regional Summary
    let regionalSummary = 'REGIONAL TABLE\nNO | REGIONAL | PS HI | RE HI | PS/RE HI\n';
    const regionalItems = tableData.filter((item: any) => item.isSubTotal);
    const sortedRegional = [...regionalItems]
      .sort((a: any, b: any) => b.psHI - a.psHI)
      .map((item: any, idx: number) => 
        `${idx + 1} | ${item.regional} | ${item.psHI} | ${item.reHI} | ${(item.psReHI || 0).toFixed(2)}%`
      );
    regionalSummary += sortedRegional.join('\n');
    
    // Branch Summary
    let branchSummary = '\nBRANCH TABLE\nNO | BRANCH | PS HI | RE HI | PS/RE HI\n';
    const branchItems = tableData.filter((item: any) => !item.isSubTotal && !item.isArea2);
    const sortedBranch = [...branchItems]
      .sort((a: any, b: any) => b.psHI - a.psHI)
      .map((item: any, idx: number) => 
        `${idx + 1} | ${item.branch} | ${item.psHI} | ${item.reHI} | ${(item.psReHI || 0).toFixed(2)}%`
      );
    branchSummary += sortedBranch.join('\n');
    
    // AREA 2 total
    branchSummary += `\n# | AREA 2 | ${area2Row.psHI} | ${area2Row.reHI} | ${(area2Row.psReHI || 0).toFixed(2)}%`;
    
    return { headerSummary, regionalSummary, branchSummary, fullSummary: headerSummary + '\n\n' + regionalSummary + '\n' + branchSummary };
  };

  // ============================================
  // HITUNG DATA FILTER
  // ============================================
  const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
  const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;

  const dateFiltered = useMemo(() => {
    return safeFilteredData.filter((row: any) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      if (fromDate && isBefore(dateCreated, fromDate)) return false;
      if (toDate && isAfter(dateCreated, toDate)) return false;
      return true;
    });
  }, [safeFilteredData, fromDate, toDate]);

  const statusFrom = statusDateFrom ? startOfDay(new Date(statusDateFrom)) : null;
  const statusTo = statusDateTo ? endOfDay(new Date(statusDateTo)) : null;

  const statusDateFiltered = useMemo(() => {
    return safeFilteredData.filter((row: any) => {
      const statusDate = parseDate(row['STATUSDATE']);
      if (!statusDate) return false;
      if (statusFrom && isBefore(statusDate, statusFrom)) return false;
      if (statusTo && isAfter(statusDate, statusTo)) return false;
      return true;
    });
  }, [safeFilteredData, statusFrom, statusTo]);

  // ============================================
  // RESULT UNTUK KARTU
  // ============================================
  const result = useMemo(() => ({
    totalRE: dateFiltered.length,
    totalPS: statusDateFiltered.filter((row: any) => row['STATUS'] === 'COMPWORK').length,
    totalCANCEL: dateFiltered.filter((row: any) => row['STATUS'] === 'CANCLWORK').length,
    totalKendalaTeknik: dateFiltered.filter(
      (row: any) =>
        row['STATUS'] === 'WORKFAIL' &&
        (row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIK' || row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIS')
    ).length,
    totalKendalaPelanggan: dateFiltered.filter(
      (row: any) => row['STATUS'] === 'WORKFAIL' && row['ERRORCODE_AKHIR'] === 'KENDALA PELANGGAN'
    ).length,
    totalKendalaLainnya: dateFiltered.filter(
      (row: any) => row['STATUS'] === 'WORKFAIL' && row['ERRORCODE_AKHIR'] === 'KENDALA LAINNYA'
    ).length,
    psRePercent: dateFiltered.length > 0
      ? (statusDateFiltered.filter((row: any) => row['STATUS'] === 'COMPWORK').length / dateFiltered.length) * 100
      : 0,
  }), [dateFiltered, statusDateFiltered]);

  // ============================================
  // HITUNG DATA TABEL PDA (VERSI BENAR)
  // ============================================
  const tableData = useMemo(() => {
    // 1. Filter data STARTWORK untuk ORDER PI
    const startworkData = safeFilteredData.filter((row: any) => row['STATUS'] === 'STARTWORK');

    // 2. Filter data untuk INPROGRESS ORDER (INSTCOMP, ACTCOMP, VALSTART, VALCOMP)
    const inprogressData = safeFilteredData.filter((row: any) =>
      ['INSTCOMP', 'ACTCOMP', 'VALSTART', 'VALCOMP'].includes(row['STATUS'])
    );

    // 3. Mapping per branch
    const branchMap = new Map<string, any>();

    // 4. Process ORDER PI (STARTWORK)
    startworkData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      const tglManja = parseDate(row['TGL_MANJA']);
      const todayDate = startOfDay(new Date());

      if (!branchMap.has(branch)) {
        branchMap.set(branch, {
          branch,
          regional: regionalMapping[branch] || 'LAINNYA',
          manjaExp: 0,
          manjaHI: 0,
          manjaH1: 0,
          nonManja: 0,
          totalOrderPI: 0,
          instComp: 0,
          actComp: 0,
          valStart: 0,
          valComp: 0,
          totalInprogress: 0,
          psHI: 0,
          reHI: 0,
          psMTD: 0,
          reMTD: 0,
        });
      }

      const bd = branchMap.get(branch);

      if (tglManja) {
        if (isBefore(tglManja, todayDate)) bd.manjaExp++;
        else if (isSameDay(tglManja, todayDate)) bd.manjaHI++;
        else if (isAfter(tglManja, todayDate)) bd.manjaH1++;
      } else {
        bd.nonManja++;
      }
    });

    // 5. Process INPROGRESS ORDER
    inprogressData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      const status = row['STATUS'] || '';

      if (!branchMap.has(branch)) {
        branchMap.set(branch, {
          branch,
          regional: regionalMapping[branch] || 'LAINNYA',
          manjaExp: 0,
          manjaHI: 0,
          manjaH1: 0,
          nonManja: 0,
          totalOrderPI: 0,
          instComp: 0,
          actComp: 0,
          valStart: 0,
          valComp: 0,
          totalInprogress: 0,
          psHI: 0,
          reHI: 0,
          psMTD: 0,
          reMTD: 0,
        });
      }

      const bd = branchMap.get(branch);

      if (status === 'INSTCOMP') bd.instComp++;
      else if (status === 'ACTCOMP') bd.actComp++;
      else if (status === 'VALSTART') bd.valStart++;
      else if (status === 'VALCOMP') bd.valComp++;
    });

    // 6. Process PS/RE
    safeFilteredData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      const status = row['STATUS'] || '';
      const dateCreated = parseDate(row['DATECREATED']);
      const statusDate = parseDate(row['STATUSDATE']);

      if (!branchMap.has(branch)) {
        branchMap.set(branch, {
          branch,
          regional: regionalMapping[branch] || 'LAINNYA',
          manjaExp: 0,
          manjaHI: 0,
          manjaH1: 0,
          nonManja: 0,
          totalOrderPI: 0,
          instComp: 0,
          actComp: 0,
          valStart: 0,
          valComp: 0,
          totalInprogress: 0,
          psHI: 0,
          reHI: 0,
          psMTD: 0,
          reMTD: 0,
        });
      }

      const bd = branchMap.get(branch);

      // RE HI: semua data dengan DATECREATED hari ini
      if (dateCreated && isSameDay(dateCreated, today)) {
        bd.reHI++;
      }

      // RE MTD: semua data dengan DATECREATED di bulan ini
      if (dateCreated && isSameMonth(dateCreated, today)) {
        bd.reMTD++;
      }

      // PS HI: COMPWORK dengan STATUSDATE hari ini
      if (status === 'COMPWORK' && statusDate && isSameDay(statusDate, today)) {
        bd.psHI++;
      }

      // PS MTD: COMPWORK dengan STATUSDATE di bulan ini
      if (status === 'COMPWORK' && statusDate && isSameMonth(statusDate, today)) {
        bd.psMTD++;
      }
    });

    // 7. Calculate totals
    const branchArray = Array.from(branchMap.values()).map((item: any) => {
      const totalOrderPI = item.manjaExp + item.manjaHI + item.manjaH1 + item.nonManja;
      const totalInprogress = item.instComp + item.actComp + item.valStart + item.valComp;
      const psReHI = item.reHI > 0 ? (item.psHI / item.reHI) * 100 : 0;
      const psReMTD = item.reMTD > 0 ? (item.psMTD / item.reMTD) * 100 : 0;

      return {
        ...item,
        totalOrderPI,
        totalInprogress,
        psReHI,
        psReMTD,
      };
    });

    // 8. Sort by regional order
    branchArray.sort((a, b) => {
      const regA = regionalOrder.indexOf(a.regional);
      const regB = regionalOrder.indexOf(b.regional);
      if (regA !== regB) return regA - regB;
      return a.branch.localeCompare(b.branch);
    });

    // 9. Add SUB TOTAL per regional
    const finalData: any[] = [];
    const regionalMap = new Map<string, any[]>();
    branchArray.forEach((item) => {
      const reg = item.regional || 'LAINNYA';
      if (!regionalMap.has(reg)) regionalMap.set(reg, []);
      regionalMap.get(reg)!.push(item);
    });

    let grandTotal: any = {
      manjaExp: 0,
      manjaHI: 0,
      manjaH1: 0,
      nonManja: 0,
      totalOrderPI: 0,
      instComp: 0,
      actComp: 0,
      valStart: 0,
      valComp: 0,
      totalInprogress: 0,
      psHI: 0,
      reHI: 0,
      psMTD: 0,
      reMTD: 0,
    };

    regionalOrder.forEach((reg) => {
      const items = regionalMap.get(reg) || [];
      if (items.length === 0) return;

      const subTotal: any = {
        branch: 'SUB TOTAL',
        regional: reg,
        isSubTotal: true,
        manjaExp: 0,
        manjaHI: 0,
        manjaH1: 0,
        nonManja: 0,
        totalOrderPI: 0,
        instComp: 0,
        actComp: 0,
        valStart: 0,
        valComp: 0,
        totalInprogress: 0,
        psHI: 0,
        reHI: 0,
        psMTD: 0,
        reMTD: 0,
      };

      items.forEach((item: any) => {
        subTotal.manjaExp += item.manjaExp;
        subTotal.manjaHI += item.manjaHI;
        subTotal.manjaH1 += item.manjaH1;
        subTotal.nonManja += item.nonManja;
        subTotal.totalOrderPI += item.totalOrderPI;
        subTotal.instComp += item.instComp;
        subTotal.actComp += item.actComp;
        subTotal.valStart += item.valStart;
        subTotal.valComp += item.valComp;
        subTotal.totalInprogress += item.totalInprogress;
        subTotal.psHI += item.psHI;
        subTotal.reHI += item.reHI;
        subTotal.psMTD += item.psMTD;
        subTotal.reMTD += item.reMTD;

        grandTotal.manjaExp += item.manjaExp;
        grandTotal.manjaHI += item.manjaHI;
        grandTotal.manjaH1 += item.manjaH1;
        grandTotal.nonManja += item.nonManja;
        grandTotal.totalOrderPI += item.totalOrderPI;
        grandTotal.instComp += item.instComp;
        grandTotal.actComp += item.actComp;
        grandTotal.valStart += item.valStart;
        grandTotal.valComp += item.valComp;
        grandTotal.totalInprogress += item.totalInprogress;
        grandTotal.psHI += item.psHI;
        grandTotal.reHI += item.reHI;
        grandTotal.psMTD += item.psMTD;
        grandTotal.reMTD += item.reMTD;
      });

      subTotal.psReHI = subTotal.reHI > 0 ? (subTotal.psHI / subTotal.reHI) * 100 : 0;
      subTotal.psReMTD = subTotal.reMTD > 0 ? (subTotal.psMTD / subTotal.reMTD) * 100 : 0;

      items.forEach((item: any) => {
        finalData.push({ ...item, isSubTotal: false });
      });
      finalData.push(subTotal);
    });

    // 10. Add AREA 2
    const area2: any = {
      branch: 'AREA 2',
      regional: 'GRAND TOTAL',
      isArea2: true,
      manjaExp: grandTotal.manjaExp,
      manjaHI: grandTotal.manjaHI,
      manjaH1: grandTotal.manjaH1,
      nonManja: grandTotal.nonManja,
      totalOrderPI: grandTotal.totalOrderPI,
      instComp: grandTotal.instComp,
      actComp: grandTotal.actComp,
      valStart: grandTotal.valStart,
      valComp: grandTotal.valComp,
      totalInprogress: grandTotal.totalInprogress,
      psHI: grandTotal.psHI,
      reHI: grandTotal.reHI,
      psMTD: grandTotal.psMTD,
      reMTD: grandTotal.reMTD,
    };

    area2.psReHI = area2.reHI > 0 ? (area2.psHI / area2.reHI) * 100 : 0;
    area2.psReMTD = area2.reMTD > 0 ? (area2.psMTD / area2.reMTD) * 100 : 0;

    finalData.push(area2);

    return finalData;
  }, [safeFilteredData]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div>
      {/* FILTER + CARDS */}
      <div className="bg-white p-3 rounded-lg shadow-md mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">📅 DATECREATED</label>
            <div className="flex gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border rounded px-2 py-1 w-full text-xs"
              />
              <span className="text-slate-400 text-xs self-center">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border rounded px-2 py-1 w-full text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">📅 STATUSDATE</label>
            <div className="flex gap-1">
              <input
                type="date"
                value={statusDateFrom}
                onChange={(e) => setStatusDateFrom(e.target.value)}
                className="border rounded px-2 py-1 w-full text-xs"
              />
              <span className="text-slate-400 text-xs self-center">—</span>
              <input
                type="date"
                value={statusDateTo}
                onChange={(e) => setStatusDateTo(e.target.value)}
                className="border rounded px-2 py-1 w-full text-xs"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="block text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
          />
          <button
            onClick={processData}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-4 rounded-lg"
          >
            🔍 Proses Data
          </button>
        </div>
        <p className="text-xs text-blue-600 font-semibold mt-1">
          📊 {safeFilteredData.length} baris data ditampilkan
        </p>
      </div>

      {/* KARTU */}
      {safeFilteredData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          {[
            { key: 'RE', label: 'TOTAL RE', val: result.totalRE, sub: 'Semua order', color: 'blue' },
            { key: 'PS', label: 'TOTAL PS', val: result.totalPS, sub: 'COMPWORK', color: 'green' },
            { key: 'CANCEL', label: 'CANCEL', val: result.totalCANCEL, sub: 'CANCLWORK', color: 'red' },
            { key: 'KENDALA_TEKNIK', label: 'KENDALA TEKNIK', val: result.totalKendalaTeknik, sub: 'WORKFAIL', color: 'amber' },
            { key: 'KENDALA_PELANGGAN', label: 'KENDALA PELANGGAN', val: result.totalKendalaPelanggan, sub: 'WORKFAIL', color: 'violet' },
            { key: 'KENDALA_LAINNYA', label: 'KENDALA LAINNYA', val: result.totalKendalaLainnya, sub: 'WORKFAIL', color: 'slate' },
          ].map((item) => (
            <div key={item.key} className={`bg-white p-2 rounded-lg shadow-md border-l-4 border-${item.color}-500 relative`}>
              <p className="text-[10px] text-slate-500 font-semibold">{item.label}</p>
              <p className={`text-lg font-bold text-${item.color}-600`}>{item.val.toLocaleString()}</p>
              <p className="text-[8px] text-slate-400">{item.sub}</p>
              <button
                onClick={() => {
                  const d = getDataForMetric(item.key);
                  downloadData(d, item.key);
                }}
                className={`absolute top-1 right-1 text-[10px] bg-${item.color}-100 hover:bg-${item.color}-200 text-${item.color}-700 px-1.5 py-0.5 rounded`}
              >
                📥
              </button>
            </div>
          ))}
          <div
            className={`bg-white p-2 rounded-lg shadow-md border-l-4 ${
              result.psRePercent >= 85 ? 'border-green-500' : 'border-yellow-500'
            }`}
          >
            <p className="text-[10px] text-slate-500 font-semibold">% PS/RE</p>
            <p className={`text-lg font-bold ${result.psRePercent >= 85 ? 'text-green-600' : 'text-yellow-600'}`}>
              {result.psRePercent.toFixed(2)}%
            </p>
            <p className="text-[8px] text-slate-400">Target 85%</p>
          </div>
        </div>
      )}

      {/* EXECUTIVE SUMMARY */}
      {safeFilteredData.length > 0 && (
        <div className="relative mb-6">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => exportSection('executive-summary-pda', 'Executive_Summary_PDA')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
            >
              🖼️ Export PNG
            </button>
          </div>
          <div id="executive-summary-pda" className="pb-4">
            <div className="bg-white p-4 rounded-lg shadow-md mb-6 relative">
              <h2 className="text-base font-bold text-slate-800 mb-3">📊 Executive Summary PDA</h2>

              {/* Grafik Bar RE & PS */}
              {(() => {
                const dailyMap = new Map<string, { re: number; ps: number }>();

                safeFilteredData.forEach((row: any) => {
                  const dateCreated = parseDate(row['DATECREATED']);
                  if (dateCreated && isSameMonth(dateCreated, today)) {
                    const key = format(dateCreated, 'yyyy-MM-dd');
                    if (!dailyMap.has(key)) dailyMap.set(key, { re: 0, ps: 0 });
                    dailyMap.get(key)!.re++;
                  }

                  const statusDate = parseDate(row['STATUSDATE']);
                  if (row['STATUS'] === 'COMPWORK' && statusDate && isSameMonth(statusDate, today)) {
                    const key = format(statusDate, 'yyyy-MM-dd');
                    if (!dailyMap.has(key)) dailyMap.set(key, { re: 0, ps: 0 });
                    dailyMap.get(key)!.ps++;
                  }
                });

                const sortedDates = Array.from(dailyMap.keys()).sort();
                const dailyData = sortedDates.map((key) => ({
                  date: new Date(key),
                  re: dailyMap.get(key)!.re,
                  ps: dailyMap.get(key)!.ps,
                  psRePercent: dailyMap.get(key)!.re > 0 ? (dailyMap.get(key)!.ps / dailyMap.get(key)!.re) * 100 : 0,
                }));

                return (
                  <>
                    <div className="mb-4 w-full">
                      <h3 className="text-xs font-semibold text-slate-600 mb-2 text-center">📈 RE & PS per Hari</h3>
                      <div className="h-48 w-full">
                        <Bar
                          data={{
                            labels: dailyData.map((item) => format(item.date, 'dd/MM')),
                            datasets: [
                              {
                                label: 'RE',
                                data: dailyData.map((item) => item.re),
                                backgroundColor: 'rgba(59, 130, 246, 0.6)',
                              },
                              {
                                label: 'PS',
                                data: dailyData.map((item) => item.ps),
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

                    <div className="mb-4 w-full">
                      <h3 className="text-xs font-semibold text-slate-600 mb-2 text-center">📈 PS/RE % per Hari</h3>
                      <div className="h-48 w-full">
                        <Line
                          data={{
                            labels: dailyData.map((item) => format(item.date, 'dd/MM')),
                            datasets: [
                              {
                                label: 'PS/RE %',
                                data: dailyData.map((item) => item.psRePercent),
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
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* SECTION: TABEL PDA + SUMMARY (1 SECTION) */}
      {/* ========================================== */}
      {safeFilteredData.length > 0 && tableData.length > 0 && (
        <div className="relative mb-6">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => exportSection('tabel-pda-content', 'Tabel_PDA')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
            >
              🖼️ Export PNG
            </button>
          </div>
          <div id="tabel-pda-content" className="pb-4">
            <div className="bg-white p-3 rounded-lg shadow-md overflow-x-auto">
              <h2 className="text-sm font-bold text-slate-800 mb-2">📋 Tabel Monitoring PDA</h2>

              {/* TABEL */}
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th rowSpan={2} className="border border-slate-600 p-1 text-center font-bold align-middle">REGIONAL TA</th>
                    <th rowSpan={2} className="border border-slate-600 p-1 text-left font-bold align-middle">BRANCH TA</th>
                    <th colSpan={5} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">ORDER PI</th>
                    <th colSpan={5} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">INPROGRESS ORDER</th>
                    <th colSpan={3} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE HI</th>
                    <th colSpan={3} className="border border-slate-600 p-1 text-center font-bold bg-slate-700">PS/RE MTD</th>
                  </tr>
                  <tr className="bg-slate-600 text-white">
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">MANJA EXP</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">MANJA HI</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">MANJA H+</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">NON MANJA</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">TOTAL</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">INSTCOMP</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">ACTCOMP</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">VALSTART</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">VALCOMP</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">TOTAL</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">PS HI</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">RE HI</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE HI</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">RE</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">PS</th>
                    <th className="border border-slate-500 p-0.5 text-center font-semibold">PS/RE</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rowsWithSpan: any[] = [];
                    let lastRegional = '';
                    let regionalCount = 0;

                    tableData.forEach((item: any, idx: number) => {
                      const isSubTotal = item.isSubTotal === true;
                      const isArea2 = item.isArea2 === true;

                      if (!isArea2) {
                        if (item.regional !== lastRegional) {
                          regionalCount = 1;
                          lastRegional = item.regional;
                          for (let i = idx + 1; i < tableData.length; i++) {
                            const next = tableData[i];
                            if (next.isArea2) break;
                            if (next.regional === item.regional) regionalCount++;
                            else break;
                          }
                        }
                      }

                      rowsWithSpan.push({
                        ...item,
                        idx,
                        isSubTotal,
                        isArea2,
                        regionalCount: isArea2 ? 1 : item.regional === lastRegional ? regionalCount : 1,
                        isFirstInRegional: !isArea2 && item.regional === lastRegional && (idx === 0 || tableData[idx - 1]?.regional !== item.regional),
                      });
                    });

                    return rowsWithSpan.map((item: any) => {
                      const rowColor = item.idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                      const isSubTotal = item.isSubTotal === true;
                      const isArea2 = item.isArea2 === true;
                      let bgColor = rowColor;
                      if (isSubTotal) bgColor = 'bg-blue-100';
                      if (isArea2) bgColor = 'bg-slate-800 text-white';

                      const psReHI = item.psReHI ?? 0;
                      const psReMTD = item.psReMTD ?? 0;

                      return (
                        <tr key={item.idx} className={`${bgColor} hover:bg-blue-50 transition-colors`}>
                          {isArea2 ? (
                            <td colSpan={2} className="border border-slate-300 p-1 font-bold text-white text-center bg-slate-800">
                              AREA 2
                            </td>
                          ) : (
                            <>
                              {item.isFirstInRegional ? (
                                <td rowSpan={item.regionalCount} className="border border-slate-300 p-1 font-bold text-slate-800">
                                  {isSubTotal ? '' : item.regional}
                                </td>
                              ) : null}
                              <td className={`border border-slate-300 p-1 font-semibold ${isSubTotal ? 'text-slate-700' : 'text-slate-700'}`}>
                                {isSubTotal ? 'SUB TOTAL' : item.branch}
                              </td>
                            </>
                          )}

                          {/* ORDER PI */}
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.manjaExp}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.manjaHI}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.manjaH1}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.nonManja}</td>
                          <td className={`border border-slate-300 p-1 text-center font-bold font-mono ${isArea2 ? 'text-white' : 'text-blue-600'}`}>{item.totalOrderPI}</td>

                          {/* INPROGRESS ORDER */}
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.instComp}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.actComp}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.valStart}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.valComp}</td>
                          <td className={`border border-slate-300 p-1 text-center font-bold font-mono ${isArea2 ? 'text-white' : 'text-blue-600'}`}>{item.totalInprogress}</td>

                          {/* PS/RE HI */}
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.psHI}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.reHI}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : psReHI >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                            {psReHI.toFixed(2)}%
                          </td>

                          {/* PS/RE MTD */}
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.reMTD}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono ${isArea2 ? 'text-white' : 'text-black'}`}>{item.psMTD}</td>
                          <td className={`border border-slate-300 p-1 text-center font-mono font-bold ${isArea2 ? 'text-white' : psReMTD >= 85 ? 'text-green-600' : 'text-red-600'}`}>
                            {psReMTD.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              {/* ========================================== */}
              {/* SUMMARY - SAMA KAYAK AO, DI DALAM 1 SECTION */}
              {/* ========================================== */}
              {(() => {
                const area2Row = tableData.find((item: any) => item.isArea2);
                if (!area2Row) return null;

                const summaries = generateSummaryReport(area2Row, tableData);

                return (
                  <div data-export-ignore="true" className="bg-slate-50 p-4 rounded-lg mt-4 border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800 mb-3">📋 Report Summary</h3>
                    
                    {/* Header Summary */}
                    <div className="mb-4 p-3 bg-white border border-slate-300 rounded">
                      <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{summaries.headerSummary}</p>
                      <button
                        onClick={() => copyToClipboard(summaries.headerSummary)}
                        className="mt-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
                      >
                        📋 Copy Header
                      </button>
                    </div>

                    {/* Regional Summary */}
                    <div className="mb-4 p-3 bg-white border border-slate-300 rounded">
                      <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{summaries.regionalSummary}</p>
                      <button
                        onClick={() => copyToClipboard(summaries.regionalSummary)}
                        className="mt-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
                      >
                        📋 Copy Regional
                      </button>
                    </div>

                    {/* Branch Summary */}
                    <div className="mb-4 p-3 bg-white border border-slate-300 rounded">
                      <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{summaries.branchSummary}</p>
                      <button
                        onClick={() => copyToClipboard(summaries.branchSummary)}
                        className="mt-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
                      >
                        📋 Copy Branch
                      </button>
                    </div>

                    {/* Full Summary */}
                    <div className="p-3 bg-white border border-slate-300 rounded">
                      <p className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-words">{summaries.fullSummary}</p>
                      <button
                        onClick={() => copyToClipboard(summaries.fullSummary)}
                        className="mt-2 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition font-bold"
                      >
                        📋 Copy All
                      </button>
                    </div>

                    {copyFeedback && (
                      <div className="mt-2 text-xs text-center text-green-600 font-semibold">{copyFeedback}</div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {safeFilteredData.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-slate-500 text-sm">
            🚀 Upload file Excel dan klik <strong>"Proses Data"</strong> untuk mulai!
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Pastikan file Excel memiliki kolom: DATECREATED, STATUSDATE, STATUS, DISTRICT_TIF, TGL_MANJA, WONUM, ERRORCODE_AKHIR
          </p>
        </div>
      )}

      <div className="mt-4 text-center text-[10px] text-slate-400">Dashboard Monitoring Order PDA AREA 2</div>
    </div>
  );
}