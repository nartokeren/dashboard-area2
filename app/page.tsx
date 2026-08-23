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
// 2. FUNGSI UTAMA
// ============================================
export default function Home() {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ============================================
  // 3. DEFAULT FILTER (BULAN INI)
  // ============================================
  useEffect(() => {
    const now = new Date();
    const firstDay = startOfMonth(now);
    setDateFrom(format(firstDay, 'yyyy-MM-dd'));
    setDateTo(format(now, 'yyyy-MM-dd'));
  }, []);

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
      if (!isNaN(num)) {
        return new Date(1899, 11, 30 + num);
      }
    }
    if (typeof value === 'number') {
      return new Date(1899, 11, 30 + value);
    }
    return null;
  };

  // ============================================
  // 5. UPLOAD FILE
  // ============================================
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        setData(json);
        setFilteredData(json);
        alert(`✅ Berhasil! ${json.length} baris data dimuat.`);
      } catch (error) {
        alert('❌ Gagal membaca file. Pastikan format Excel benar.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ============================================
  // 6. PROSES DATA (FILTER)
  // ============================================
  const processData = () => {
    if (data.length === 0) {
      alert('⚠️ Upload file Excel dulu ya!');
      return;
    }

    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    const filtered = data.filter(row => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;

      let match = true;
      if (fromDate && isBefore(dateCreated, fromDate)) match = false;
      if (toDate && isAfter(dateCreated, toDate)) match = false;
      
      return match;
    });

    setFilteredData(filtered);
    alert(`✅ Filter berhasil! ${filtered.length} baris data.`);
  };

  // ============================================
  // 7. HITUNG SEMUA METRIK
  // ============================================
  const calculateBranchData = () => {
    // --- 7a. METRIK KARTU (7 Kartu) ---
    const totalRE = filteredData.length;
    const totalPS = filteredData.filter(row => row['STATUS'] === 'COMPWORK').length;
    const totalCANCEL = filteredData.filter(row => row['STATUS'] === 'CANCLWORK').length;
    
    const totalKendalaTeknik = filteredData.filter(row => 
      row['STATUS'] === 'WORKFAIL' && 
      (row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIK' || row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIS')
    ).length;
    
    const totalKendalaPelanggan = filteredData.filter(row => 
      row['STATUS'] === 'WORKFAIL' && 
      row['ERRORCODE_AKHIR'] === 'KENDALA PELANGGAN'
    ).length;
    
    const totalKendalaLainnya = filteredData.filter(row => 
      row['STATUS'] === 'WORKFAIL' && 
      row['ERRORCODE_AKHIR'] === 'KENDALA LAINNYA'
    ).length;
    
    const psRePercent = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;

    // --- 7b. DATA PER BRANCH ---
    const branchMap = new Map<string, any>();

    filteredData.forEach(row => {
      const branch = row['DISTRICT_TIF'] || 'UNKNOWN';
      const regional = regionalMapping[branch] || 'LAINNYA';
      const status = row['STATUS'] || '';
      const dateCreated = parseDate(row['DATECREATED']);
      const statusDate = parseDate(row['STATUSDATE']);
      const tglManja = parseDate(row['TGL_MANJA']);
      const wonum = row['WONUM'] || '';

      if (!branchMap.has(branch)) {
        branchMap.set(branch, {
          branch,
          regional,
          // ORDER PI
          manjaExp: 0,
          manjaHI: 0,
          manjaHPlus: 0,
          nonManja: 0,
          // FALLOUT ORDER
          workfail: 0,
          contwork: 0,
          instcomp: 0,
          // INPROGRESS ORDER
          actcomp: 0,
          valstart: 0,
          valcomp: 0,
          // PS TO RE
          psHI: 0,
          reHI: 0,
          psMTD: 0,
          reMTD: 0,
          allWonum: new Set(),
        });
      }

      const branchData = branchMap.get(branch);
      branchData.allWonum.add(wonum);

      // --- ORDER PI (STARTWORK) ---
      if (status === 'STARTWORK' && tglManja) {
        if (isBefore(tglManja, new Date())) {
          branchData.manjaExp++;
        } else if (isSameDay(tglManja, new Date())) {
          branchData.manjaHI++;
        } else if (isAfter(tglManja, new Date())) {
          branchData.manjaHPlus++;
        }
      } else if (status === 'STARTWORK' && !tglManja) {
        branchData.nonManja++;
      }

      // --- FALLOUT ORDER ---
      if (status === 'WORKFAIL' && dateCreated && isSameMonth(dateCreated, new Date())) {
        branchData.workfail++;
      }
      if (status === 'CONTWORK' && statusDate && isSameDay(statusDate, new Date())) {
        branchData.contwork++;
      }
      if (status === 'INSTCOMP' && statusDate && isSameDay(statusDate, new Date())) {
        branchData.instcomp++;
      }

      // --- INPROGRESS ORDER ---
      if (status === 'ACTCOMP' && statusDate && isSameDay(statusDate, new Date())) {
        branchData.actcomp++;
      }
      if (status === 'VALSTART' && statusDate && isSameDay(statusDate, new Date())) {
        branchData.valstart++;
      }
      if (status === 'VALCOMP' && statusDate && isSameDay(statusDate, new Date())) {
        branchData.valcomp++;
      }

      // --- PS HI / RE HI (HARI INI) ---
      if (status === 'COMPWORK' && statusDate && isSameDay(statusDate, new Date())) {
        branchData.psHI++;
      }
      if (dateCreated && isSameDay(dateCreated, new Date())) {
        branchData.reHI++;
      }

      // --- PS MTD / RE MTD (BULAN INI) ---
      if (status === 'COMPWORK' && statusDate && isSameMonth(statusDate, new Date())) {
        branchData.psMTD++;
      }
      if (dateCreated && isSameMonth(dateCreated, new Date())) {
        branchData.reMTD++;
      }
    });

    // --- 7c. HITUNG TOTAL & POTENSI ---
    const branchArray = Array.from(branchMap.values()).map(item => {
      const totalOrderPI = item.manjaExp + item.manjaHI + item.manjaHPlus + item.nonManja;
      const totalFallout = item.workfail + item.contwork + item.instcomp;
      const totalInprogress = item.actcomp + item.valstart + item.valcomp;
      const psReHI = item.reHI > 0 ? (item.psHI / item.reHI) * 100 : 0;
      const potensiPS = item.psHI + totalInprogress;
      const potensiPsRe = item.reHI > 0 ? (potensiPS / item.reHI) * 100 : 0;
      const psReMTD = item.reMTD > 0 ? (item.psMTD / item.reMTD) * 100 : 0;

      // TARGET HI
      const tgtPSHI = 2300;
      const devHI = item.psHI - tgtPSHI;
      const achHI = tgtPSHI > 0 ? (item.psHI / tgtPSHI) * 100 : 0;
      const checkHI = item.psHI >= tgtPSHI ? '✅' : '❌';

      // TARGET MTD
      const dayOfMonth = new Date().getDate();
      const tgtPSMTD = 2300 * dayOfMonth;
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
    branchArray.sort((a, b) => {
      const regA = regionalOrder.indexOf(a.regional);
      const regB = regionalOrder.indexOf(b.regional);
      if (regA !== regB) return regA - regB;
      return a.branch.localeCompare(b.branch);
    });

    return {
      totalRE,
      totalPS,
      totalCANCEL,
      totalKendalaTeknik,
      totalKendalaPelanggan,
      totalKendalaLainnya,
      psRePercent,
      branchArray,
    };
  };

  const result = calculateBranchData();

  // ============================================
  // 8. TAMPILAN WEBSITE (HTML)
  // ============================================
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="bg-slate-800 text-white p-4 md:p-6 rounded-lg shadow-lg mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-center">
            Report Monitoring Order Indihome AREA 2
          </h1>
          <p className="text-center text-slate-300 text-sm mt-1">
            Periode: {dateFrom ? format(new Date(dateFrom), 'dd MMMM yyyy') : '-'} — {dateTo ? format(new Date(dateTo), 'dd MMMM yyyy') : '-'}
          </p>
        </div>

        {/* FILTER TANGGAL & UPLOAD */}
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">📅 Filter Tanggal (DATECREATED)</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border rounded px-3 py-2 w-full sm:w-auto text-sm"
                />
                <span className="text-slate-400 text-center self-center hidden sm:block">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border rounded px-3 py-2 w-full sm:w-auto text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              <button
                onClick={processData}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition w-full sm:w-auto"
              >
                🔍 Proses Data
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {filteredData.length > 0 ? `📊 ${filteredData.length} baris data ditampilkan` : '📭 Belum ada data'}
          </p>
        </div>

        {/* 7 KARTU METRIK */}
        {filteredData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-blue-500">
              <p className="text-xs text-slate-500 font-semibold">TOTAL RE</p>
              <p className="text-xl font-bold text-blue-600">{result.totalRE.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">Semua order</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-green-500">
              <p className="text-xs text-slate-500 font-semibold">TOTAL PS</p>
              <p className="text-xl font-bold text-green-600">{result.totalPS.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">COMPWORK</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-red-500">
              <p className="text-xs text-slate-500 font-semibold">CANCEL</p>
              <p className="text-xl font-bold text-red-600">{result.totalCANCEL.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">CANCLWORK</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-amber-500">
              <p className="text-xs text-slate-500 font-semibold">KENDALA TEKNIK</p>
              <p className="text-xl font-bold text-amber-600">{result.totalKendalaTeknik.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">WORKFAIL</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-violet-500">
              <p className="text-xs text-slate-500 font-semibold">KENDALA PELANGGAN</p>
              <p className="text-xl font-bold text-violet-600">{result.totalKendalaPelanggan.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">WORKFAIL</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-md border-l-4 border-slate-400">
              <p className="text-xs text-slate-500 font-semibold">KENDALA LAINNYA</p>
              <p className="text-xl font-bold text-slate-600">{result.totalKendalaLainnya.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">WORKFAIL</p>
            </div>
            <div className={`bg-white p-3 rounded-lg shadow-md border-l-4 ${result.psRePercent >= 85 ? 'border-green-500' : 'border-yellow-500'}`}>
              <p className="text-xs text-slate-500 font-semibold">% PS/RE</p>
              <p className={`text-xl font-bold ${result.psRePercent >= 85 ? 'text-green-600' : 'text-yellow-600'}`}>
                {result.psRePercent.toFixed(2)}%
              </p>
              <p className="text-[10px] text-slate-400">Target 85%</p>
            </div>
          </div>
        )}

        {/* TABEL COMPLEX - 31 KOLOM */}
        {filteredData.length > 0 && result.branchArray.length > 0 && (
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-md overflow-x-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-4">📋 REGIONAL BRANCH ORDER PI</h2>
            
            <table className="w-full text-xs border-collapse">
              <thead>
  {/* ========================================== */}
  {/* BARIS 1 - Header Utama */}
  {/* ========================================== */}
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

  {/* ========================================== */}
  {/* BARIS 2 - Sub-Header */}
  {/* ========================================== */}
  <tr className="bg-slate-600 text-white">
    <th colSpan={3} className="border border-slate-500 p-1 text-center font-semibold">STATUS</th>
    <th rowSpan={2} className="border border-slate-500 p-1 text-center font-semibold align-middle">TOTAL</th>
    <th colSpan={3} className="border border-slate-500 p-1 text-center font-semibold">STATUS</th>
    <th rowSpan={2} className="border border-slate-500 p-1 text-center font-semibold align-middle">TOTAL</th>
    <th colSpan={3} className="border border-slate-500 p-1 text-center font-semibold">REALISASI PS/RE HI</th>
    <th colSpan={2} className="border border-slate-500 p-1 text-center font-semibold">POTENSI HI</th>
    <th colSpan={3} className="border border-slate-500 p-1 text-center font-semibold">MTD</th>
  </tr>

  {/* ========================================== */}
  {/* BARIS 3 - Detail Kolom (TANPA KOLOM KOSONG) */}
  {/* ========================================== */}
  <tr className="bg-slate-600 text-white">
    {/* 2 KOLOM PERTAMA KOSONG (REGIONAL & BRANCH sudah di-rowspan) */}
    
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
                {result.branchArray.map((item, idx) => {
                  const rowColor = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                  return (
                    <tr key={idx} className={`${rowColor} hover:bg-blue-50 transition-colors`}>
                      {/* REGIONAL & BRANCH */}
                      <td className="border border-slate-300 p-2 font-bold text-slate-800">{item.regional}</td>
                      <td className="border border-slate-300 p-2 font-semibold text-slate-700">{item.branch}</td>
                      
                      {/* ORDER PI (5 kolom) */}
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.manjaExp}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.manjaHI}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.manjaHPlus}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.nonManja}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold font-mono text-blue-600">{item.totalOrderPI}</td>
                      
                      {/* FALLOUT ORDER (4 kolom) */}
                      <td className="border border-slate-300 p-2 text-center font-mono text-red-600">{item.workfail}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.contwork}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.instcomp}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold font-mono text-blue-600">{item.totalFallout}</td>
                      
                      {/* INPROGRESS ORDER (4 kolom) */}
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.actcomp}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.valstart}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.valcomp}</td>
                      <td className="border border-slate-300 p-2 text-center font-bold font-mono text-blue-600">{item.totalInprogress}</td>
                      
                      {/* PS TO RE (8 kolom) */}
                      <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-green-700">{item.psHI}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.reHI}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-semibold">{item.psReHI.toFixed(2)}%</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.potensiPS}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.potensiPsRe.toFixed(2)}%</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.reMTD}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-semibold text-indigo-700">{item.psMTD}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-semibold">{item.psReMTD.toFixed(2)}%</td>
                      
                      {/* PS TO TARGET HI (4 kolom) */}
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.tgtPSHI.toLocaleString()}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.devHI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.devHI.toLocaleString()}
                      </td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.achHI >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.achHI.toFixed(2)}%
                      </td>
                      <td className="border border-slate-300 p-2 text-center text-lg font-bold">{item.checkHI}</td>
                      
                      {/* PS TO TARGET MTD (4 kolom) */}
                      <td className="border border-slate-300 p-2 text-center font-mono">{item.tgtPSMTD.toLocaleString()}</td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.devMTD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.devMTD.toLocaleString()}
                      </td>
                      <td className={`border border-slate-300 p-2 text-center font-mono font-semibold ${item.achMTD >= 100 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.achMTD.toFixed(2)}%
                      </td>
                      <td className="border border-slate-300 p-2 text-center text-lg font-bold">{item.checkMTD}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* KOSONG */}
        {filteredData.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-slate-500 text-lg">
              🚀 Upload file Excel dan klik <strong>"Proses Data"</strong> untuk mulai!
            </p>
            <p className="text-slate-400 text-sm mt-2">
              Pastikan file Excel memiliki kolom: DATECREATED, STATUSDATE, STATUS, DISTRICT_TIF, TGL_MANJA, WONUM, ERRORCODE_AKHIR
            </p>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Dashboard Monitoring Order Indihome AREA 2
        </div>

      </div>
    </main>
  );
}