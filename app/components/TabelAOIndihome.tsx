'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, startOfDay, endOfDay, isBefore, isAfter, isSameDay, isSameMonth } from 'date-fns';
import * as XLSX from 'xlsx';

// ✅ IMPORT DARI CONSTANTS
import { regionalMapping, targetMapping } from '@/constants';
// ✅ IMPORT DARI UTILS
import { parseDate } from '@/utils/date';

import FilterAndCards from './TabelAOIndihome/FilterAndCards';
import ExecutiveSummary from './TabelAOIndihome/ExecutiveSummary';
import TabelFulfillment from './TabelAOIndihome/TabelFulfillment';
import TabelPsReH1 from './TabelAOIndihome/TabelPsReH1';
import TabelPerJam from './TabelAOIndihome/TabelPerJam';
import TabelSisaOrderMTD from './TabelAOIndihome/TabelSisaOrderMTD';
import TabelSisaOrder from './TabelAOIndihome/TabelSisaOrder';

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

  const exportSection = async (elementId: string, fileName: string) => {
    try {
      const domtoimage = (await import('dom-to-image')).default;
      const element = document.getElementById(elementId);
      if (!element) {
        alert('❌ Elemen tidak ditemukan!');
        return;
      }

      const hiddenSummaryNodes = Array.from(
        element.querySelectorAll('[data-export-ignore="true"]')
      ) as HTMLElement[];

      const originalDisplayStates = hiddenSummaryNodes.map((node) => ({
        node,
        display: node.style.display,
        visibility: node.style.visibility,
      }));

      originalDisplayStates.forEach(({ node }) => {
        node.style.display = 'none';
        node.style.visibility = 'hidden';
      });

      const originalOverflow = element.style.overflow;
      const originalWidth = element.style.width;
      const originalMinWidth = element.style.minWidth;
      const originalMaxWidth = element.style.maxWidth;
      const originalTransform = element.style.transform;

      element.style.overflow = 'visible';
      element.style.width = 'auto';
      element.style.minWidth = 'max-content';
      element.style.maxWidth = 'none';
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
        filter: (node: any) => {
          if (node.className && node.className.includes && node.className.includes('bg-purple-600')) {
            return false;
          }
          return true;
        }
      });

      element.style.overflow = originalOverflow;
      element.style.width = originalWidth;
      element.style.minWidth = originalMinWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.transform = originalTransform;

      originalDisplayStates.forEach(({ node, display, visibility }) => {
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

  // ✅ PAKE useMemo BIAR GA BERAT
  const result = useMemo(() => ({
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
  }), [dateFiltered, statusDateFiltered]);

  return (
    <div>
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

      <div className="relative mb-6">
        <div className="flex justify-end mb-2">
          <button
            onClick={() => exportSection('tabel-psre-h1-content', 'PS_RE_H1')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1 px-3 rounded-lg transition"
          >
            🖼️ Export PNG
          </button>
        </div>
        <div id="tabel-psre-h1-content" className="pb-4">
          <TabelPsReH1
            filteredData={safeFilteredData}
            dateFrom={dateFrom}
            dateTo={dateTo}
            regionalMapping={regionalMapping}
            parseDate={parseDate}
            exportSection={exportSection}
          />
        </div>
      </div>

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