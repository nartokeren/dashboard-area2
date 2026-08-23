'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, isToday, isSameDay, isSameMonth, isAfter, isBefore } from 'date-fns';

// ============================================
// 1. MAPPING REGIONAL
// ============================================
const regionalMapping: { [key: string]: string } = {
  'SERANG': 'BANTEN',
  'TANGERANG': 'BANTEN',
  'BEKASI': 'EASTERN JABOTABEK',
  'BOGOR': 'EASTERN JABOTABEK',
  'KARAWANG': 'EASTERN JABOTABEK',
  'NORTHERN JAKARTA': 'JAKARTA',
  'SOUTHERN JAKARTA': 'JAKARTA',
  'BANDUNG': 'JAWA BARAT',
  'CIREBON': 'JAWA BARAT',
  'SOREANG': 'JAWA BARAT',
  'TASIKMALAYA': 'JAWA BARAT',
};

// ============================================
// 2. TARGET PER BRANCH
// ============================================
const targetMapping: { [key: string]: number } = {
  'SERANG': 181,
  'TANGERANG': 179,
  'BEKASI': 197,
  'BOGOR': 201,
  'KARAWANG': 185,
  'NORTHERN JAKARTA': 239,
  'SOUTHERN JAKARTA': 365,
  'BANDUNG': 401,
  'CIREBON': 89,
  'SOREANG': 161,
  'TASIKMALAYA': 116,
};

// ============================================
// 3. KOMPONEN UTAMA
// ============================================
export default function TabelAOIndihome({
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
}: any) {
  // ============================================
  // 4. PARSE TANGGAL
  // ============================================
  const parseDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
      const num = parseFloat(value);
      if (!isNaN(num)) return new Date(1899, 11, 30 + num);
    }
    if (typeof value === 'number') return new Date(1899, 11, 30 + value);
    return null;
  };

  // ============================================
  // 5. HITUNG SEMUA METRIK
  // ============================================
  const calculateBranchData = () => {
    const totalRE = filteredData.length;
    const totalPS = filteredData.filter((row:any) => row['STATUS'] === 'COMPWORK').length;
    const totalCANCEL = filteredData.filter((row: any) => row['STATUS'] === 'CANCLWORK').length;
    const totalKendalaTeknik = filteredData.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      (row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIK' || row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIS')
    ).length;
    const totalKendalaPelanggan = filteredData.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      row['ERRORCODE_AKHIR'] === 'KENDALA PELANGGAN'
    ).length;
    const totalKendalaLainnya = filteredData.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      row['ERRORCODE_AKHIR'] === 'KENDALA LAINNYA'
    ).length;
    const psRePercent = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;

    const branchMap = new Map<string, any>();
    filteredData.forEach((row: any) => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      const regional = regionalMapping[branch] || 'LAINNYA';
      const status = row['STATUS'] || '';
      const dateCreated = parseDate(row['DATECREATED']);
      const statusDate = parseDate(row['STATUSDATE']);
      const tglManja = parseDate(row['TGL_MANJA']);

      if (!branchMap.has(branch)) {
        branchMap.set(branch, {
          branch, regional,
          manjaExp: 0, manjaHI: 0, manjaHPlus: 0, nonManja: 0,
          workfail: 0, contwork: 0, instcomp: 0,
          actcomp: 0, valstart: 0, valcomp: 0,
          psHI: 0, reHI: 0, psMTD: 0, reMTD: 0,
        });
      }
      const branchData = branchMap.get(branch);

      if (status === 'STARTWORK' && tglManja) {
        if (isBefore(tglManja, new Date())) branchData.manjaExp++;
        else if (isSameDay(tglManja, new Date())) branchData.manjaHI++;
        else if (isAfter(tglManja, new Date())) branchData.manjaHPlus++;
      } else if (status === 'STARTWORK' && !tglManja) {
        branchData.nonManja++;
      }

      if (status === 'WORKFAIL' && dateCreated && isSameMonth(dateCreated, new Date())) branchData.workfail++;
      if (status === 'CONTWORK' && statusDate && isSameDay(statusDate, new Date())) branchData.contwork++;
      if (status === 'INSTCOMP' && statusDate && isSameDay(statusDate, new Date())) branchData.instcomp++;
      if (status === 'ACTCOMP' && statusDate && isSameDay(statusDate, new Date())) branchData.actcomp++;
      if (status === 'VALSTART' && statusDate && isSameDay(statusDate, new Date())) branchData.valstart++;
      if (status === 'VALCOMP' && statusDate && isSameDay(statusDate, new Date())) branchData.valcomp++;

      if (status === 'COMPWORK' && statusDate && isSameDay(statusDate, new Date())) branchData.psHI++;
      if (dateCreated && isSameDay(dateCreated, new Date())) branchData.reHI++;
      if (status === 'COMPWORK' && statusDate && isSameMonth(statusDate, new Date())) branchData.psMTD++;
      if (dateCreated && isSameMonth(dateCreated, new Date())) branchData.reMTD++;
    });

    const branchArray = Array.from(branchMap.values()).map(item => {
      const totalOrderPI = item.manjaExp + item.manjaHI + item.manjaHPlus + item.nonManja;
      const totalFallout = item.workfail + item.contwork + item.instcomp;
      const totalInprogress = item.actcomp + item.valstart + item.valcomp;
      const psReHI = item.reHI > 0 ? (item.psHI / item.reHI) * 100 : 0;
      const potensiPS = item.psHI + totalInprogress;
      const potensiPsRe = item.reHI > 0 ? (potensiPS / item.reHI) * 100 : 0;
      const psReMTD = item.reMTD > 0 ? (item.psMTD / item.reMTD) * 100 : 0;

      const tgtPSHI = targetMapping[item.branch] || 0;
      const devHI = item.psHI - tgtPSHI;
      const achHI = tgtPSHI > 0 ? (item.psHI / tgtPSHI) * 100 : 0;
      const checkHI = item.psHI >= tgtPSHI ? '✅' : '❌';

      const dayOfMonth = new Date().getDate();
      const tgtPSMTD = tgtPSHI * dayOfMonth;
      const devMTD = item.psMTD - tgtPSMTD;
      const achMTD = tgtPSMTD > 0 ? (item.psMTD / tgtPSMTD) * 100 : 0;
      const checkMTD = item.psMTD >= tgtPSMTD ? '✅' : '❌';

      return {
        ...item,
        totalOrderPI,
        totalFallout,
        totalInprogress,
        potensiPS,
        psReHI,
        potensiPsRe,
        psReMTD,
        tgtPSHI,
        devHI,
        achHI,
        checkHI,
        tgtPSMTD,
        devMTD,
        achMTD,
        checkMTD,
      };
    });

    const regionalOrder = ['BANTEN', 'EASTERN JABOTABEK', 'JAKARTA', 'JAWA BARAT'];
    const regionalMap = new Map<string, any[]>();
    branchArray.forEach(item => {
      const regional = item.regional || 'LAINNYA';
      if (!regionalMap.has(regional)) {
        regionalMap.set(regional, []);
      }
      regionalMap.get(regional)!.push(item);
    });

    regionalMap.forEach((branches, regional) => {
      branches.sort((a, b) => a.branch.localeCompare(b.branch));
    });

    const finalData: any[] = [];
    let grandTotal: any = {
      manjaExp: 0, manjaHI: 0, manjaHPlus: 0, nonManja: 0,
      workfail: 0, contwork: 0, instcomp: 0,
      actcomp: 0, valstart: 0, valcomp: 0,
      psHI: 0, reHI: 0, psMTD: 0, reMTD: 0,
    };

    regionalOrder.forEach(regional => {
      const branches = regionalMap.get(regional) || [];
      if (branches.length === 0) return;

      const subTotal: any = {
        branch: 'SUB TOTAL',
        regional: regional,
        isSubTotal: true,
        manjaExp: 0, manjaHI: 0, manjaHPlus: 0, nonManja: 0,
        workfail: 0, contwork: 0, instcomp: 0,
        actcomp: 0, valstart: 0, valcomp: 0,
        psHI: 0, reHI: 0, psMTD: 0, reMTD: 0,
      };

      branches.forEach(item => {
        subTotal.manjaExp += item.manjaExp;
        subTotal.manjaHI += item.manjaHI;
        subTotal.manjaHPlus += item.manjaHPlus;
        subTotal.nonManja += item.nonManja;
        subTotal.workfail += item.workfail;
        subTotal.contwork += item.contwork;
        subTotal.instcomp += item.instcomp;
        subTotal.actcomp += item.actcomp;
        subTotal.valstart += item.valstart;
        subTotal.valcomp += item.valcomp;
        subTotal.psHI += item.psHI;
        subTotal.reHI += item.reHI;
        subTotal.psMTD += item.psMTD;
        subTotal.reMTD += item.reMTD;

        grandTotal.manjaExp += item.manjaExp;
        grandTotal.manjaHI += item.manjaHI;
        grandTotal.manjaHPlus += item.manjaHPlus;
        grandTotal.nonManja += item.nonManja;
        grandTotal.workfail += item.workfail;
        grandTotal.contwork += item.contwork;
        grandTotal.instcomp += item.instcomp;
        grandTotal.actcomp += item.actcomp;
        grandTotal.valstart += item.valstart;
        grandTotal.valcomp += item.valcomp;
        grandTotal.psHI += item.psHI;
        grandTotal.reHI += item.reHI;
        grandTotal.psMTD += item.psMTD;
        grandTotal.reMTD += item.reMTD;
      });

      subTotal.totalOrderPI = subTotal.manjaExp + subTotal.manjaHI + subTotal.manjaHPlus + subTotal.nonManja;
      subTotal.totalFallout = subTotal.workfail + subTotal.contwork + subTotal.instcomp;
      subTotal.totalInprogress = subTotal.actcomp + subTotal.valstart + subTotal.valcomp;
      subTotal.psReHI = subTotal.reHI > 0 ? (subTotal.psHI / subTotal.reHI) * 100 : 0;
      subTotal.potensiPS = subTotal.psHI + subTotal.totalInprogress;
      subTotal.potensiPsRe = subTotal.reHI > 0 ? (subTotal.potensiPS / subTotal.reHI) * 100 : 0;
      subTotal.psReMTD = subTotal.reMTD > 0 ? (subTotal.psMTD / subTotal.reMTD) * 100 : 0;

      let subTotalTgt = 0;
      branches.forEach(item => { subTotalTgt += item.tgtPSHI; });
      subTotal.tgtPSHI = subTotalTgt;
      subTotal.devHI = subTotal.psHI - subTotalTgt;
      subTotal.achHI = subTotalTgt > 0 ? (subTotal.psHI / subTotalTgt) * 100 : 0;
      subTotal.checkHI = subTotal.psHI >= subTotalTgt ? '✅' : '❌';

      const dayOfMonth = new Date().getDate();
      subTotal.tgtPSMTD = subTotalTgt * dayOfMonth;
      subTotal.devMTD = subTotal.psMTD - subTotal.tgtPSMTD;
      subTotal.achMTD = subTotal.tgtPSMTD > 0 ? (subTotal.psMTD / subTotal.tgtPSMTD) * 100 : 0;
      subTotal.checkMTD = subTotal.psMTD >= subTotal.tgtPSMTD ? '✅' : '❌';

      branches.forEach(item => {
        finalData.push({ ...item, isSubTotal: false });
      });
      finalData.push(subTotal);
    });

    const area2: any = {
      branch: 'AREA 2',
      regional: 'GRAND TOTAL',
      isArea2: true,
      manjaExp: grandTotal.manjaExp,
      manjaHI: grandTotal.manjaHI,
      manjaHPlus: grandTotal.manjaHPlus,
      nonManja: grandTotal.nonManja,
      workfail: grandTotal.workfail,
      contwork: grandTotal.contwork,
      instcomp: grandTotal.instcomp,
      actcomp: grandTotal.actcomp,
      valstart: grandTotal.valstart,
      valcomp: grandTotal.valcomp,
      psHI: grandTotal.psHI,
      reHI: grandTotal.reHI,
      psMTD: grandTotal.psMTD,
      reMTD: grandTotal.reMTD,
    };

    area2.totalOrderPI = area2.manjaExp + area2.manjaHI + area2.manjaHPlus + area2.nonManja;
    area2.totalFallout = area2.workfail + area2.contwork + area2.instcomp;
    area2.totalInprogress = area2.actcomp + area2.valstart + area2.valcomp;
    area2.psReHI = area2.reHI > 0 ? (area2.psHI / area2.reHI) * 100 : 0;
    area2.potensiPS = area2.psHI + area2.totalInprogress;
    area2.potensiPsRe = area2.reHI > 0 ? (area2.potensiPS / area2.reHI) * 100 : 0;
    area2.psReMTD = area2.reMTD > 0 ? (area2.psMTD / area2.reMTD) * 100 : 0;

    let area2Tgt = 0;
    branchArray.forEach(item => { area2Tgt += item.tgtPSHI; });
    area2.tgtPSHI = area2Tgt;
    area2.devHI = area2.psHI - area2Tgt;
    area2.achHI = area2Tgt > 0 ? (area2.psHI / area2Tgt) * 100 : 0;
    area2.checkHI = area2.psHI >= area2Tgt ? '✅' : '❌';

    const dayOfMonth = new Date().getDate();
    area2.tgtPSMTD = area2Tgt * dayOfMonth;
    area2.devMTD = area2.psMTD - area2.tgtPSMTD;
    area2.achMTD = area2.tgtPSMTD > 0 ? (area2.psMTD / area2.tgtPSMTD) * 100 : 0;
    area2.checkMTD = area2.psMTD >= area2.tgtPSMTD ? '✅' : '❌';

    finalData.push(area2);

    return {
      totalRE,
      totalPS,
      totalCANCEL,
      totalKendalaTeknik,
      totalKendalaPelanggan,
      totalKendalaLainnya,
      psRePercent,
      branchArray: finalData,
    };
  };

  const result = calculateBranchData();

  // ============================================
  // 6. TAMPILAN WEBSITE (HTML)
  // ============================================
  return (
    <div>
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-1">📅 Filter Tanggal (DATECREATED)</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded px-3 py-2 w-full sm:w-auto text-sm" />
              <span className="text-slate-400 text-center self-center hidden sm:block">—</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded px-3 py-2 w-full sm:w-auto text-sm" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
            <button onClick={processData} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition w-full sm:w-auto">🔍 Proses Data</button>
            <button onClick={exportToPNG} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition w-full sm:w-auto">🖼️ Export PNG</button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">{filteredData.length > 0 ? `📊 ${filteredData.length} baris data ditampilkan` : '📭 Belum ada data'}</p>
      </div>

      {filteredData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-blue-500"><p className="text-xs text-slate-500 font-semibold">TOTAL RE</p><p className="text-xl font-bold text-blue-600">{result.totalRE.toLocaleString()}</p><p className="text-[10px] text-slate-400">Semua order</p></div>
          <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-green-500"><p className="text-xs text-slate-500 font-semibold">TOTAL PS</p><p className="text-xl font-bold text-green-600">{result.totalPS.toLocaleString()}</p><p className="text-[10px] text-slate-400">COMPWORK</p></div>
          <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-red-500"><p className="text-xs text-slate-500 font-semibold">CANCEL</p><p className="text-xl font-bold text-red-600">{result.totalCANCEL.toLocaleString()}</p><p className="text-[10px] text-slate-400">CANCLWORK</p></div>
          <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-amber-500"><p className="text-xs text-slate-500 font-semibold">KENDALA TEKNIK</p><p className="text-xl font-bold text-amber-600">{result.totalKendalaTeknik.toLocaleString()}</p><p className="text-[10px] text-slate-400">WORKFAIL</p></div>
          <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-violet-500"><p className="text-xs text-slate-500 font-semibold">KENDALA PELANGGAN</p><p className="text-xl font-bold text-violet-600">{result.totalKendalaPelanggan.toLocaleString()}</p><p className="text-[10px] text-slate-400">WORKFAIL</p></div>
          <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-slate-400"><p className="text-xs text-slate-500 font-semibold">KENDALA LAINNYA</p><p className="text-xl font-bold text-slate-600">{result.totalKendalaLainnya.toLocaleString()}</p><p className="text-[10px] text-slate-400">WORKFAIL</p></div>
          <div className={`bg-white p-3 rounded-lg shadow-md border-l-4 ${result.psRePercent >= 85 ? 'border-green-500' : 'border-yellow-500'}`}>
            <p className="text-xs text-slate-500 font-semibold">% PS/RE</p>
            <p className={`text-xl font-bold ${result.psRePercent >= 85 ? 'text-green-600' : 'text-yellow-600'}`}>{result.psRePercent.toFixed(2)}%</p>
            <p className="text-[10px] text-slate-400">Target 85%</p>
          </div>
        </div>
      )}

      {filteredData.length > 0 && result.branchArray.length > 0 && (
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md overflow-x-auto" id="table-container">
          <h2 className="text-lg font-bold text-slate-800 mb-4">📋 (New Sales) Fulfillment Endstate AREA 2</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th rowSpan={3} className="border border-slate-600 p-2 text-left font-bold align-middle">REGIONAL</th>
                <th rowSpan={3} className="border border-slate-600 p-2 text-left font-bold align-middle">BRANCH</th>
                <th rowSpan={2} colSpan={5} className="border border-slate-600 p-2 text-center font-bold bg-slate-700">ORDER PI</th>
                <th colSpan={4} className="border border-slate-600 p-2 text-center font-bold bg-slate-700">FALLOUT ORDER</th>
                <th colSpan={4} className="border border-slate-600 p-2 text-center font-bold bg-slate-700">INPROGRESS ORDER</th>
                <th colSpan={8} className="border border-slate-600 p-2 text-center font-bold bg-slate-700">PS TO RE</th>
                <th rowSpan={2} colSpan={4} className="border border-slate-600 p-2 text-center font-bold bg-slate-700">PS TO TARGET HI</th>
                <th rowSpan={2} colSpan={4} className="border border-slate-600 p-2 text-center font-bold bg-slate-700">PS TO TARGET MTD</th>
              </tr>
              <tr className="bg-slate-600 text-white">
                <th colSpan={3} className="border border-slate-500 p-1 text-center font-semibold">STATUS</th>
                <th rowSpan={2} className="border border-slate-500 p-1 text-center font-semibold align-middle">TOTAL</th>
                <th colSpan={3} className="border border-slate-500 p-1 text-center font-semibold">STATUS</th>
                <th rowSpan={2} className="border border-slate-500 p-1 text-center font-semibold align-middle">TOTAL</th>
                <th colSpan={3} className="border border-slate-500 p-1 text-center font-semibold">REALISASI PS/RE HI</th>
                <th colSpan={2} className="border border-slate-500 p-1 text-center font-semibold">POTENSI HI</th>
                <th colSpan={3} className="border border-slate-500 p-1 text-center font-semibold">MTD</th>
              </tr>
              {/* BARIS 3 - Detail Kolom (TANPA KOLOM KOSONG) */}
<tr className="bg-slate-600 text-white">
  {/* ORDER PI (5 kolom) */}
  <th className="border border-slate-500 p-1 text-center font-semibold">MANJA EXP</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">MANJA HI</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">MANJA H+</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">NON MANJA</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">TOTAL</th>

  {/* FALLOUT ORDER (3 kolom, TOTAL sudah di-rowspan dari baris 2) */}
  <th className="border border-slate-500 p-1 text-center font-semibold">WORKFAIL</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">CONTWORK</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">INSTCOMP</th>

  {/* INPROGRESS ORDER (3 kolom, TOTAL sudah di-rowspan dari baris 2) */}
  <th className="border border-slate-500 p-1 text-center font-semibold">ACTCOMP</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">VALSTART</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">VALCOMP</th>

  {/* PS TO RE (8 kolom) */}
  <th className="border border-slate-500 p-1 text-center font-semibold">PS HI</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">RE HI</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">PS/RE HI</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">PS</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">PS/RE</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">RE</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">PS</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">PS/RE</th>

  {/* PS TO TARGET HI (4 kolom) */}
  <th className="border border-slate-500 p-1 text-center font-semibold">Tgt PS 2.3K</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">DEV</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">ACH</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">CHECK</th>

  {/* PS TO TARGET MTD (4 kolom) */}
  <th className="border border-slate-500 p-1 text-center font-semibold">Tgt PS MTD</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">DEV</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">ACH</th>
  <th className="border border-slate-500 p-1 text-center font-semibold">CHECK</th>
</tr>
            </thead>
            <tbody>
              {(() => {
                const rows: any[] = [];
                let lastRegional = '';
                let regionalCount = 0;
                
                result.branchArray.forEach((item, idx) => {
                  const isSubTotal = item.isSubTotal === true;
                  const isArea2 = item.isArea2 === true;
                  
                  if (!isArea2) {
                    if (item.regional !== lastRegional) {
                      regionalCount = 1;
                      lastRegional = item.regional;
                      for (let i = idx + 1; i < result.branchArray.length; i++) {
                        const next = result.branchArray[i];
                        if (next.isArea2) break;
                        if (next.regional === item.regional) regionalCount++;
                        else break;
                      }
                    }
                  }
                  
                  rows.push({
                    ...item,
                    idx,
                    isSubTotal,
                    isArea2,
                    regionalCount: isArea2 ? 1 : (item.regional === lastRegional ? regionalCount : 1),
                    isFirstInRegional: !isArea2 && item.regional === lastRegional && (idx === 0 || result.branchArray[idx-1]?.regional !== item.regional),
                  });
                });
                
                return rows.map((item) => {
                  const rowColor = item.idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                  let bgColor = rowColor;
                  if (item.isSubTotal) bgColor = 'bg-blue-100 hover:bg-blue-200';
                  if (item.isArea2) bgColor = 'bg-slate-800 text-white hover:bg-slate-700';

                  return (
                    <tr key={item.idx} className={`${bgColor} hover:bg-blue-50 transition-colors`}>
                      {item.isArea2 ? (
                        <td colSpan={2} className="border border-slate-300 p-2 font-bold text-white text-center bg-slate-800">
                          AREA 2
                        </td>
                      ) : (
                        <>
                          {item.isFirstInRegional ? (
                            <td rowSpan={item.regionalCount} className={`border border-slate-300 p-2 font-bold ${item.isSubTotal ? 'text-slate-800' : 'text-slate-800'}`}>
                              {item.isSubTotal ? '' : item.regional}
                            </td>
                          ) : null}
                          <td className={`border border-slate-300 p-2 font-semibold ${item.isSubTotal ? 'text-slate-700' : 'text-slate-700'}`}>
                            {item.isSubTotal ? 'SUB TOTAL' : item.branch}
                          </td>
                        </>
                      )}
                      
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.manjaExp > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.manjaExp}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.manjaHI > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.manjaHI}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.manjaHPlus > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.manjaHPlus}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.nonManja > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.nonManja}</td>
                      <td className={`border border-slate-300 p-2 text-center font-bold font-mono ${item.isArea2 ? 'text-white' : 'text-blue-600'}`}>{item.totalOrderPI}</td>
                      
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.workfail > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.workfail}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.contwork > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.contwork}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.instcomp > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.instcomp}</td>
                      <td className={`border border-slate-300 p-2 text-center font-bold font-mono ${item.isArea2 ? 'text-white' : 'text-blue-600'}`}>{item.totalFallout}</td>
                      
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.actcomp > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.actcomp}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.valstart > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.valstart}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : (item.valcomp > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold')}`}>{item.valcomp}</td>
                      <td className={`border border-slate-300 p-2 text-center font-bold font-mono ${item.isArea2 ? 'text-white' : 'text-blue-600'}`}>{item.totalInprogress}</td>
                      
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.psHI}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.reHI}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-bold ${item.isArea2 ? 'text-white' : (item.psReHI >= 85 ? 'text-green-600' : 'text-red-600')}`}>{item.psReHI.toFixed(2)}%</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.potensiPS}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-bold ${item.isArea2 ? 'text-white' : (item.potensiPsRe >= 85 ? 'text-green-600' : 'text-red-600')}`}>{item.potensiPsRe.toFixed(2)}%</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.reMTD}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.psMTD}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-bold ${item.isArea2 ? 'text-white' : (item.psReMTD >= 85 ? 'text-green-600' : 'text-red-600')}`}>{item.psReMTD.toFixed(2)}%</td>
                      
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.tgtPSHI.toLocaleString()}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.isArea2 ? 'text-white' : (item.devHI < 0 ? 'text-red-600' : 'text-black')}`}>{item.devHI.toLocaleString()}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.isArea2 ? 'text-white' : (item.achHI < 60 ? 'text-red-600' : item.achHI <= 80 ? 'text-yellow-600' : 'text-green-600')}`}>{item.achHI.toFixed(2)}%</td>
                      <td className={`border border-slate-300 p-2 text-center text-lg font-bold ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.checkHI}</td>
                      
                      <td className={`border border-slate-300 p-2 text-center font-mono ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.tgtPSMTD.toLocaleString()}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.isArea2 ? 'text-white' : (item.devMTD < 0 ? 'text-red-600' : 'text-black')}`}>{item.devMTD.toLocaleString()}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.isArea2 ? 'text-white' : (item.achMTD < 60 ? 'text-red-600' : item.achMTD <= 80 ? 'text-yellow-600' : 'text-green-600')}`}>{item.achMTD.toFixed(2)}%</td>
                      <td className={`border border-slate-300 p-2 text-center text-lg font-bold ${item.isArea2 ? 'text-white' : 'text-black'}`}>{item.checkMTD}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {filteredData.length === 0 && (
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-slate-500 text-lg">🚀 Upload file Excel dan klik <strong>"Proses Data"</strong> untuk mulai!</p>
          <p className="text-slate-400 text-sm mt-2">Pastikan file Excel memiliki kolom: DATECREATED, STATUSDATE, STATUS, DISTRICT_TIF, TGL_MANJA, WONUM, ERRORCODE_AKHIR</p>
        </div>
      )}
      <div className="mt-6 text-center text-xs text-slate-400">Dashboard Monitoring Order Indihome AREA 2</div>
    </div>
  );
}