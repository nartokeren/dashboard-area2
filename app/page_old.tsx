'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

// Ini adalah komponen utama dashboard
export default function Home() {
  // Tempat nyimpen data
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  
  // Filter tanggal
  const [dateFrom1, setDateFrom1] = useState('');
  const [dateTo1, setDateTo1] = useState('');
  const [dateFrom2, setDateFrom2] = useState('');
  const [dateTo2, setDateTo2] = useState('');
  
  // Buat expand district
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);

  // ============================================
  // FUNGSI UPLOAD FILE
  // ============================================
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target?.result, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      
      setData(json);
      setFilteredData(json);
      alert(`✅ Berhasil! ${json.length} baris data dimuat.`);
    };
    reader.readAsArrayBuffer(file);
  };

  // ============================================
  // FUNGSI PROSES DATA (FILTER + HITUNG)
  // ============================================
  const processData = () => {
    if (data.length === 0) {
      alert('⚠️ Upload file Excel dulu ya!');
      return;
    }

    // Ubah string tanggal jadi Date object
    const parseDate = (val: any): Date => {
      if (val instanceof Date) return val;
      if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        // Coba format Excel serial number
        const num = parseFloat(val);
        if (!isNaN(num)) {
          return new Date(1899, 11, 30 + num);
        }
      }
      return new Date();
    };

    // Filter data
    const filtered = data.filter(row => {
      const dateCreated = parseDate(row['DATECREATED']);
      const statusDate = parseDate(row['STATUSDATE']);
      
      // Filter untuk DATECREATED
      let match1 = true;
      if (dateFrom1) {
        const from = new Date(dateFrom1);
        if (dateCreated < from) match1 = false;
      }
      if (dateTo1) {
        const to = new Date(dateTo1);
        if (dateCreated > to) match1 = false;
      }

      // Filter untuk STATUSDATE (hanya buat PS)
      let match2 = true;
      if (dateFrom2) {
        const from = new Date(dateFrom2);
        if (statusDate < from) match2 = false;
      }
      if (dateTo2) {
        const to = new Date(dateTo2);
        if (statusDate > to) match2 = false;
      }

      // Kalo STATUS COMPWORK, harus lolos filter 1 DAN filter 2
      if (row['STATUS'] === 'COMPWORK') {
        return match1 && match2;
      }
      
      // Kalo bukan COMPWORK, cukup lolos filter 1
      return match1;
    });

    setFilteredData(filtered);
    alert(`✅ Filter berhasil! ${filtered.length} baris data.`);
  };

  // ============================================
  // FUNGSI HITUNG METRIK
  // ============================================
  const calculateMetrics = () => {
    // Total RE = semua data yang lolos filter
    const totalRE = filteredData.length;

    // Total PS = data dengan STATUS COMPWORK
    const totalPS = filteredData.filter(row => row['STATUS'] === 'COMPWORK').length;

    // PS/RE %
    const psPercentage = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;

    return { totalRE, totalPS, psPercentage };
  };

  // ============================================
  // FUNGSI HITUNG PER DISTRICT
  // ============================================
  const calculateDistrictData = () => {
    const districtMap = new Map<string, { ps: Set<string>; re: Set<string>; stoMap: Map<string, { ps: Set<string>; re: Set<string> }> }>();

    filteredData.forEach(row => {
      const district = row['DISTRICT_TIF'] || 'Unknown';
      const sto = row['STO'] || 'Unknown';
      const wonum = String(row['WONUM'] || '');

      if (!districtMap.has(district)) {
        districtMap.set(district, {
          ps: new Set(),
          re: new Set(),
          stoMap: new Map(),
        });
      }

      const districtData = districtMap.get(district)!;

      if (!districtData.stoMap.has(sto)) {
        districtData.stoMap.set(sto, { ps: new Set(), re: new Set() });
      }
      const stoData = districtData.stoMap.get(sto)!;

      // Kalo STATUS COMPWORK -> PS
      if (row['STATUS'] === 'COMPWORK') {
        districtData.ps.add(wonum);
        stoData.ps.add(wonum);
      } else {
        // Selain COMPWORK -> RE
        districtData.re.add(wonum);
        stoData.re.add(wonum);
      }
    });

    const result: any[] = [];
    districtMap.forEach((value, district) => {
      const totalPS = value.ps.size;
      const totalRE = value.re.size;
      const psPercent = totalRE > 0 ? (totalPS / totalRE) * 100 : 0;

      const stoData = Array.from(value.stoMap.entries()).map(([sto, stoValue]) => {
        const stoPS = stoValue.ps.size;
        const stoRE = stoValue.re.size;
        return {
          sto,
          totalPS: stoPS,
          totalRE: stoRE,
          psPercent: stoRE > 0 ? (stoPS / stoRE) * 100 : 0,
        };
      });

      result.push({
        district,
        totalPS,
        totalRE,
        psPercent,
        stoData,
      });
    });

    // Urutkan berdasarkan abjad
    return result.sort((a, b) => a.district.localeCompare(b.district));
  };

  // ============================================
  // AMBIL DATA UNTUK DITAMPILKAN
  // ============================================
  const metrics = calculateMetrics();
  const districtData = calculateDistrictData();

  // ============================================
  // FUNGSI TOGGLE EXPAND DISTRICT
  // ============================================
  const toggleDistrict = (district: string) => {
    if (expandedDistrict === district) {
      setExpandedDistrict(null);
    } else {
      setExpandedDistrict(district);
    }
  };

  // ============================================
  // TAMPILAN WEBSITE (HTML)
  // ============================================
  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* JUDUL */}
        <h1 className="text-2xl md:text-4xl font-bold text-center text-blue-800 mb-6">
          📊 Report Monitoring Order Indihome AREA 2
        </h1>

        {/* ========================================== */}
        {/* BAGIAN UPLOAD */}
        {/* ========================================== */}
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-lg font-semibold mb-3">📂 Upload Data Excel</h2>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={processData}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition w-full sm:w-auto"
            >
              🔍 Proses Data
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {data.length > 0 ? `📊 ${data.length} baris data dimuat` : '📭 Belum ada data'}
          </p>
        </div>

        {/* ========================================== */}
        {/* BAGIAN FILTER */}
        {/* ========================================== */}
        <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-lg font-semibold mb-3">📅 Filter Tanggal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-sm text-gray-700 mb-1">DATECREATED <span className="text-xs text-gray-400">(Total RE)</span></h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={dateFrom1}
                  onChange={(e) => setDateFrom1(e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm"
                />
                <input
                  type="date"
                  value={dateTo1}
                  onChange={(e) => setDateTo1(e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm"
                />
              </div>
            </div>
            <div>
              <h3 className="font-medium text-sm text-gray-700 mb-1">STATUSDATE <span className="text-xs text-gray-400">(Total PS)</span></h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={dateFrom2}
                  onChange={(e) => setDateFrom2(e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm"
                />
                <input
                  type="date"
                  value={dateTo2}
                  onChange={(e) => setDateTo2(e.target.value)}
                  className="border rounded px-3 py-2 w-full text-sm"
                />
              </div>
            </div>
          </div>
          <button
            onClick={processData}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            📊 Terapkan Filter
          </button>
        </div>

        {/* ========================================== */}
        {/* KARTU ANGKA BESAR */}
        {/* ========================================== */}
        {filteredData.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md border-l-4 border-blue-500">
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Total RE</h3>
              <p className="text-2xl md:text-4xl font-bold text-blue-600">{metrics.totalRE.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Semua order</p>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-lg shadow-md border-l-4 border-green-500">
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Total PS</h3>
              <p className="text-2xl md:text-4xl font-bold text-green-600">{metrics.totalPS.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Status COMPWORK</p>
            </div>
            <div className={`bg-white p-4 md:p-6 rounded-lg shadow-md border-l-4 ${
              metrics.psPercentage >= 85 ? 'border-green-500' : 'border-yellow-500'
            }`}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase">PS/RE</h3>
              <p className={`text-2xl md:text-4xl font-bold ${
                metrics.psPercentage >= 85 ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {metrics.psPercentage.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Target 85% 
                {metrics.psPercentage >= 85 ? ' 🟢 ON TARGET!' : ' 🔴 Butuh Improvement'}
                {metrics.psPercentage > 100 && ' 🔥 LUAR BIASA!'}
              </p>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* PROGRESS BAR PER DISTRICT */}
        {/* ========================================== */}
        {districtData.length > 0 && (
          <div className="bg-white p-4 md:p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">📊 PS/RE % per District</h2>
            <p className="text-sm text-gray-400 mb-4">Target: 85% 🎯</p>
            
            <div className="space-y-4">
              {districtData.map((item) => {
                const isExpanded = expandedDistrict === item.district;
                const psPercent = item.psPercent;
                const isOnTarget = psPercent >= 85;
                const isExcellent = psPercent > 100;
                
                // Warna progress bar
                let barColor = 'bg-red-500';
                if (isExcellent) barColor = 'bg-purple-600';
                else if (isOnTarget) barColor = 'bg-green-500';
                else if (psPercent >= 70) barColor = 'bg-yellow-500';
                
                return (
                  <div key={item.district} className="border-b border-gray-100 pb-3 last:border-0">
                    {/* Nama District + klik buat expand */}
                    <div 
                      className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
                      onClick={() => toggleDistrict(item.district)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">
                          {item.district}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({item.totalRE} RE)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-sm ${
                          isExcellent ? 'text-purple-600' : 
                          isOnTarget ? 'text-green-600' : 
                          'text-red-500'
                        }`}>
                          {psPercent.toFixed(2)}%
                        </span>
                        <span className="text-xs text-gray-400">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`${barColor} h-4 rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(psPercent, 100)}%` }}
                      ></div>
                    </div>

                    {/* Target line indicator */}
                    <div className="relative h-0">
                      <div 
                        className="absolute top-0 w-0.5 h-4 bg-gray-700"
                        style={{ left: '85%' }}
                      ></div>
                    </div>

                    {/* Status text */}
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-400">
                        PS: {item.totalPS} | RE: {item.totalRE}
                      </span>
                      <span className="text-xs">
                        {isExcellent && '🔥 Excellent!'}
                        {isOnTarget && !isExcellent && '✅ On Target'}
                        {!isOnTarget && '📈 Perlu Improvement'}
                      </span>
                    </div>

                    {/* ========================================== */}
                    {/* DRILL-DOWN STO (Expand) */}
                    {/* ========================================== */}
                    {isExpanded && item.stoData.length > 0 && (
                      <div className="mt-3 ml-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-600 mb-2">📌 Breakdown per STO</h4>
                        <div className="space-y-2">
                          {item.stoData.map((sto: any) => (
                            <div key={sto.sto} className="flex justify-between items-center text-sm border-b border-gray-100 pb-1">
                              <span className="text-gray-600">{sto.sto}</span>
                              <div className="flex gap-4">
                                <span className="text-gray-500">PS: {sto.totalPS}</span>
                                <span className="text-gray-500">RE: {sto.totalRE}</span>
                                <span className={`font-semibold ${
                                  sto.psPercent >= 85 ? 'text-green-600' : 'text-red-500'
                                }`}>
                                  {sto.psPercent.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* KOSONG / PANDUAN */}
        {/* ========================================== */}
        {filteredData.length === 0 && (
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <p className="text-gray-500 text-lg">
              🚀 Upload file Excel dan klik <strong>"Proses Data"</strong> untuk mulai!
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Pastikan file Excel memiliki kolom: DATECREATED, STATUSDATE, STATUS, DISTRICT_TIF, STO, WONUM
            </p>
          </div>
        )}

        {/* ========================================== */}
        {/* FOOTER */}
        {/* ========================================== */}
        <div className="mt-8 text-center text-xs text-gray-400">
          Dashboard Monitoring Order Indihome AREA 2
        </div>

      </div>
    </main>
  );
}