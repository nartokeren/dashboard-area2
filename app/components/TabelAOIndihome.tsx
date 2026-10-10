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
        width: element.scrollWidth * 2,
        height: element.scrollHeight * 2,
        style: {
          transform: 'scale(2)',
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
      />

      <div className="relative mb-6">
        <div className={`flex justify-end mb-2 ${safeFilteredData.length === 0 ? 'hidden' : ''}`}>
          <button
            onClick={() => exportSection('executive-summary-content', 'Executive_Summary')}
            className="report-action report-action--export"
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
        <div className={`flex justify-end mb-2 ${safeFilteredData.length === 0 ? 'hidden' : ''}`}>
          <button
            onClick={() => exportSection('tabel-fulfillment-content', 'Fulfillment_Endstate')}
            className="report-action report-action--export"
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
        <div className={`flex justify-end mb-2 ${safeFilteredData.length === 0 ? 'hidden' : ''}`}>
          <button
            onClick={() => exportSection('tabel-psre-h1-content', 'PS_RE_H1')}
            className="report-action report-action--export"
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
        <div className={`flex justify-end mb-2 ${safeFilteredData.length === 0 ? 'hidden' : ''}`}>
          <button
            onClick={() => exportSection('tabel-perjam-content', 'PerJam')}
            className="report-action report-action--export"
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
        <div className={`flex justify-end mb-2 ${safeFilteredData.length === 0 ? 'hidden' : ''}`}>
          <button
            onClick={() => exportSection('tabel-sisaorder-mtd-content', 'Sisa_Order_MTD')}
            className="report-action report-action--export"
          >
            🖼️ Export PNG
          </button>
        </div>
        <div id="tabel-sisaorder-mtd-content" className="pb-4">
          <TabelSisaOrderMTD
            uploadedData={data || []}
            parseDate={parseDate}
          />
        </div>
      </div>

      <div className="relative mb-6">
        <div className={`flex justify-end mb-2 ${safeFilteredData.length === 0 ? 'hidden' : ''}`}>
          <button
            onClick={() => exportSection('tabel-sisaorder-h1-content', 'Sisa_Order_H1')}
            className="report-action report-action--export"
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
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Belum ada data report</p>
          <p className="mt-1 text-xs text-slate-500">Import file Excel lalu pilih Proses Data untuk membentuk report Indihome AO.</p>
        </div>
      )}
      <div className="mt-4 text-center text-[10px] text-slate-400">Dashboard Monitoring Order Indihome AREA 2</div>
    </div>
  );
}