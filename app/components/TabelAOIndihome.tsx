'use client';

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, startOfDay, endOfDay, isBefore, isAfter, isSameDay, isSameMonth } from 'date-fns';
import * as XLSX from 'xlsx';

// Import komponen yang sudah dipisah
import FilterAndCards from './TabelAOIndihome/FilterAndCards';
import ExecutiveSummary from './TabelAOIndihome/ExecutiveSummary';
import TabelFulfillment from './TabelAOIndihome/TabelFulfillment';
import TabelPerJam from './TabelAOIndihome/TabelPerJam';
import TabelSisaOrderMTD from './TabelAOIndihome/TabelSisaOrderMTD';
import TabelSisaOrder from './TabelAOIndihome/TabelSisaOrder';

// ============================================
// MAPPING REGIONAL
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
// TARGET PER BRANCH
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
// KOMPONEN UTAMA
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

  const safeFilteredData = filteredData || [];
  const [statusDateFrom, setStatusDateFrom] = useState('');
  const [statusDateTo, setStatusDateTo] = useState('');
  const currentHour = new Date().getHours();
  const today = new Date();

  useEffect(() => {
    const now = new Date();
    const firstDay = startOfMonth(now);
    setDateFrom(format(firstDay, 'yyyy-MM-dd'));
    setDateTo(format(now, 'yyyy-MM-dd'));
    setStatusDateFrom(format(firstDay, 'yyyy-MM-dd'));
    setStatusDateTo(format(now, 'yyyy-MM-dd'));
  }, []);

  const excelSerialToDate = (num: number): Date => {
    const wholeDays = Math.floor(num);
    const fractionalDay = num - wholeDays;
    const totalSeconds = Math.round(fractionalDay * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return new Date(1899, 11, 30 + wholeDays, hours, minutes, seconds);
  };

  const parseDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
      const num = parseFloat(value);
      if (!isNaN(num)) return excelSerialToDate(num);
    }
    if (typeof value === 'number') return excelSerialToDate(value);
    return null;
  };

  const downloadData = (data: any[], label: string) => {
    if (data.length === 0) {
      alert(`⚠️ Tidak ada data untuk ${label}`);
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(h => `"${row[h]}"`);
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${label}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const getDataForMetric = (type: string) => {
    switch(type) {
      case 'RE': return safeFilteredData;
      case 'PS': return safeFilteredData.filter((row: any) => row['STATUS'] === 'COMPWORK');
      case 'CANCEL': return safeFilteredData.filter((row: any) => row['STATUS'] === 'CANCLWORK');
      case 'KENDALA_TEKNIK': return safeFilteredData.filter((row: any) => row['STATUS'] === 'WORKFAIL' && (row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIK' || row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIS'));
      case 'KENDALA_PELANGGAN': return safeFilteredData.filter((row: any) => row['STATUS'] === 'WORKFAIL' && row['ERRORCODE_AKHIR'] === 'KENDALA PELANGGAN');
      case 'KENDALA_LAINNYA': return safeFilteredData.filter((row: any) => row['STATUS'] === 'WORKFAIL' && row['ERRORCODE_AKHIR'] === 'KENDALA LAINNYA');
      default: return [];
    }
  };

  // ============================================
  // EXPORT PER SECTION
  // ============================================
  const exportSection = async (elementId: string, fileName: string) => {
    try {
      const domtoimage = (await import('dom-to-image')).default;
      const element = document.getElementById(elementId);
      if (!element) {
        alert('❌ Elemen tidak ditemukan!');
        return;
      }

      const dataUrl = await domtoimage.toPng(element, {
        quality: 1,
        bgcolor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          overflow: 'visible',
        }
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
  // HITUNG RESULT UNTUK KARTU
  // ============================================
  const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
  const toDate = dateTo ? endOfDay(new Date(dateTo)) : null;

  const dateFiltered = safeFilteredData.filter((row: any) => {
    const dateCreated = parseDate(row['DATECREATED']);
    if (!dateCreated) return false;
    if (fromDate && isBefore(dateCreated, fromDate)) return false;
    if (toDate && isAfter(dateCreated, toDate)) return false;
    return true;
  });

  const statusFrom = statusDateFrom ? startOfDay(new Date(statusDateFrom)) : null;
  const statusTo = statusDateTo ? endOfDay(new Date(statusDateTo)) : null;

  const statusDateFiltered = safeFilteredData.filter((row: any) => {
    const statusDate = parseDate(row['STATUSDATE']);
    if (!statusDate) return false;
    if (statusFrom && isBefore(statusDate, statusFrom)) return false;
    if (statusTo && isAfter(statusDate, statusTo)) return false;
    return true;
  });

  const result = {
    totalRE: dateFiltered.length,
    totalPS: statusDateFiltered.filter((row: any) => row['STATUS'] === 'COMPWORK').length,
    totalCANCEL: dateFiltered.filter((row: any) => row['STATUS'] === 'CANCLWORK').length,
    totalKendalaTeknik: dateFiltered.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      (row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIK' || row['ERRORCODE_AKHIR'] === 'KENDALA TEKNIS')
    ).length,
    totalKendalaPelanggan: dateFiltered.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      row['ERRORCODE_AKHIR'] === 'KENDALA PELANGGAN'
    ).length,
    totalKendalaLainnya: dateFiltered.filter((row: any) => 
      row['STATUS'] === 'WORKFAIL' && 
      row['ERRORCODE_AKHIR'] === 'KENDALA LAINNYA'
    ).length,
    psRePercent: dateFiltered.length > 0 ? (statusDateFiltered.filter((row: any) => row['STATUS'] === 'COMPWORK').length / dateFiltered.length) * 100 : 0,
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div>
      {/* FILTER + KARTU */}
      <FilterAndCards
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        statusDateFrom={statusDateFrom}
        setStatusDateFrom={setStatusDateFrom}
        statusDateTo={statusDateTo}
        setStatusDateTo={setStatusDateTo}
        handleFileUpload={handleFileUpload}
        processData={processData}
        filteredData={safeFilteredData}
        result={result}
        getDataForMetric={getDataForMetric}
        downloadData={downloadData}
      />

      {/* ========================================== */}
      {/* SECTION 1: EXECUTIVE SUMMARY */}
      {/* ========================================== */}
      <div className="relative mb-6">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportSection('executive-summary-content', 'Executive_Summary')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        </div>
        <div id="executive-summary-content" className="pb-4">
          <ExecutiveSummary
            filteredData={safeFilteredData}
            dateFrom={dateFrom}
            dateTo={dateTo}
            statusDateFrom={statusDateFrom}
            statusDateTo={statusDateTo}
            regionalMapping={regionalMapping}
            parseDate={parseDate}
          />
        </div>
      </div>

      {/* ========================================== */}
      {/* SECTION 2: TABEL FULFILLMENT */}
      {/* ========================================== */}
      <div className="relative mb-6">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportSection('tabel-fulfillment-content', 'Fulfillment_Endstate')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        </div>
        <div id="tabel-fulfillment-content" className="pb-4">
          <TabelFulfillment
            filteredData={safeFilteredData}
            dateFrom={dateFrom}
            dateTo={dateTo}
            statusDateFrom={statusDateFrom}
            statusDateTo={statusDateTo}
            regionalMapping={regionalMapping}
            targetMapping={targetMapping}
            parseDate={parseDate}
          />
        </div>
      </div>

      {/* ========================================== */}
      {/* SECTION 3: TABEL PER-JAM */}
      {/* ========================================== */}
      <div className="relative mb-6">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportSection('tabel-perjam-content', 'PerJam')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        </div>
        <div id="tabel-perjam-content" className="pb-4">
          <TabelPerJam
            filteredData={safeFilteredData}
            dateFrom={dateFrom}
            dateTo={dateTo}
            statusDateFrom={statusDateFrom}
            statusDateTo={statusDateTo}
            today={today}
            currentHour={currentHour}
            regionalMapping={regionalMapping}
            parseDate={parseDate}
          />
        </div>
      </div>

      {/* ========================================== */}
      {/* SECTION 4: TABEL SISA ORDER MTD */}
      {/* ========================================== */}
      <div className="relative mb-6">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportSection('tabel-sisaorder-mtd-content', 'Sisa_Order_MTD')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        </div>
        <div id="tabel-sisaorder-mtd-content" className="pb-4">
          <TabelSisaOrderMTD
            filteredData={safeFilteredData}
            parseDate={parseDate}
          />
        </div>
      </div>

      {/* ========================================== */}
      {/* SECTION 5: TABEL SISA ORDER H-1 */}
      {/* ========================================== */}
      <div className="relative mb-6">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportSection('tabel-sisaorder-h1-content', 'Sisa_Order_H1')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        </div>
        <div id="tabel-sisaorder-h1-content" className="pb-4">
          <TabelSisaOrder
            filteredData={safeFilteredData}
            dateTo={dateTo}
            parseDate={parseDate}
          />
        </div>
      </div>

      {safeFilteredData.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-slate-500 text-sm">🚀 Upload file Excel dan klik <strong>"Proses Data"</strong> untuk mulai!</p>
          <p className="text-slate-400 text-xs mt-1">Pastikan file Excel memiliki kolom: DATECREATED, STATUSDATE, STATUS, DISTRICT_TIF, TGL_MANJA, WONUM, ERRORCODE_AKHIR</p>
        </div>
      )}
      <div className="mt-4 text-center text-[10px] text-slate-400">Dashboard Monitoring Order Indihome AREA 2</div>
    </div>
  );
}