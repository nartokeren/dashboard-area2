'use client';

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, isBefore, isAfter } from 'date-fns';
import { FaBars, FaTimes } from 'react-icons/fa';

// ✅ IMPORT DARI CONSTANTS
import { regionalMapping, targetMapping } from '@/constants';
// ✅ IMPORT DARI UTILS
import { parseDate } from '@/utils/date';

import Sidebar from '../components/Sidebar';
import TabelAOIndihome from '../components/TabelAOIndihome';
import TabelPDAIndihome from '../components/TabelPDAIndihome';
import TabelEBIS from '../components/TabelEBIS';
import TabelKosong from '../components/TabelKosong';

export default function DashboardPage() {
  const [activeMenu, setActiveMenu] = useState<string>('daily-report');
  const [activeSubMenu, setActiveSubMenu] = useState<string>('indihome');
  const [activeSubSubMenu, setActiveSubSubMenu] = useState<string>('indihome-ao');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const categoryKeys = [
    'indihome-ao',
    'indihome-pda',
    'indibiz-ao',
    'indibiz-pda',
    'ebis-datin',
    'ebis-wifi',
  ];

  const [dataPerCategory, setDataPerCategory] = useState<{
    [key: string]: any[];
  }>(() => {
    const obj: { [key: string]: any[] } = {};
    categoryKeys.forEach((key) => { obj[key] = []; });
    return obj;
  });

  const [filteredDataPerCategory, setFilteredDataPerCategory] = useState<{
    [key: string]: any[];
  }>(() => {
    const obj: { [key: string]: any[] } = {};
    categoryKeys.forEach((key) => { obj[key] = []; });
    return obj;
  });

  useEffect(() => {
    setDateFrom('');
    setDateTo('');
  }, []);

  const currentKey = activeSubSubMenu || 'indihome-ao';

  const handleMenuSelect = (menuId: string, subMenuId?: string, subSubMenuId?: string) => {
    setActiveMenu(menuId);
    if (subMenuId) setActiveSubMenu(subMenuId);
    if (subSubMenuId) {
      setActiveSubSubMenu(subSubMenuId);
    } else if (subMenuId) {
      if (subMenuId === 'indihome') setActiveSubSubMenu('indihome-ao');
      else if (subMenuId === 'indibiz') setActiveSubSubMenu('indibiz-ao');
      else if (subMenuId === 'ebis') setActiveSubSubMenu('ebis-datin');
    }
    setIsSidebarOpen(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      // STEP 1: Baca file mentah dari user
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      
      // STEP 2: Baca workbook pake library xlsx (SUPPORT SEMUA FORMAT!)
      const workbook = XLSX.read(data, { type: 'array' });

      // STEP 3: 🔥 KALAU FILENYA .xls, CONVERT KE .xlsx DULU!
      let fileToProcess = workbook;
      if (file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
        console.log('🔄 File .xls terdeteksi, mengconvert ke .xlsx...');
        
        // Tulis ulang workbook jadi format .xlsx di memory (tanpa save ke disk!)
        const xlsxData = XLSX.write(workbook, { 
          bookType: 'xlsx', 
          type: 'array' 
        });
        
        // Baca ulang hasil convert .xlsx-nya
        const convertedWorkbook = XLSX.read(xlsxData, { type: 'array' });
        fileToProcess = convertedWorkbook;
        
        console.log('✅ Berhasil convert .xls → .xlsx di memory!');
      }

      // STEP 4: Ambil sheet pertama dan cari baris header sebenarnya
      const sheet = fileToProcess.Sheets[fileToProcess.SheetNames[0]];
      const isEbisUpload = currentKey.startsWith('ebis-');
      let json: Record<string, unknown>[];

      if (isEbisUpload) {
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
        const headerIndex = matrix.findIndex((row) =>
          row.some((cell) => String(cell ?? '').trim().toUpperCase() === 'DESCRIPTION')
        );

        if (headerIndex === -1) {
          throw new Error('Header Description tidak ditemukan di file Excel EBIS.');
        }

        const headers = matrix[headerIndex].map((header, index) => {
          const name = String(header ?? '').trim();
          return name || `COLUMN_${index}`;
        });
        json = matrix.slice(headerIndex + 1).map((values) =>
          headers.reduce((row, header, index) => {
            row[header] = values[index] ?? null;
            return row;
          }, {} as Record<string, unknown>)
        );
      } else {
        json = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
      }

      // STEP 5: Mapping data
      const getColumn = (row: any, names: string[]) => {
        const normalizedRow = Object.keys(row).reduce((result, key) => {
          result[key.trim().toUpperCase().replace(/\s+/g, '_')] = row[key];
          return result;
        }, {} as Record<string, unknown>);

        const sourceName = names.find((name) => {
          const normalizedName = name.trim().toUpperCase().replace(/\s+/g, '_');
          return normalizedRow[normalizedName] !== undefined;
        });

        return sourceName
          ? normalizedRow[sourceName.trim().toUpperCase().replace(/\s+/g, '_')]
          : null;
      };

      const rawData = json.map((row: any) => ({
        WONUM: String(getColumn(row, ['WONUM']) || ''),
        NoOrder: String(getColumn(row, ['NO ORDER', 'NO_ORDER', 'WONUM']) || ''),
        SCID: String(getColumn(row, ['SC', 'SCID', 'NO ORDER', 'NO_ORDER']) || ''),
        STATUS: String(getColumn(row, ['STATUS']) || ''),
        DATECREATED: getColumn(row, ['DATECREATED']),
        STATUSDATE: getColumn(row, ['STATUSDATE']),
        Description: String(getColumn(row, ['DESCRIPTION', 'Description']) || ''),
        TTDC: getColumn(row, ['TTDC', 'DURASI TTDC']),
        Regional: String(getColumn(row, ['REGIONAL', 'REGION']) || ''),
        District: String(getColumn(row, ['DISTRICT', 'DISTRICT_TIF']) || ''),
        DISTRICT_TIF: String(getColumn(row, ['DISTRICT_TIF', 'DISTRICT']) || ''),
        HSA: String(getColumn(row, ['HSA']) || ''),
        Sisa: String(getColumn(row, ['SISA', 'SISA TTDC', 'SISA_TTDC']) || ''),
        TGL_MANJA: getColumn(row, ['TGL_MANJA']),
        ERRORCODE_AKHIR: String(getColumn(row, ['ERRORCODE_AKHIR']) || ''),
        SUBERRORCODE_AKHIR: String(getColumn(row, ['SUBERRORCODE_AKHIR']) || ''),
        WORKZONE: isEbisUpload ? String(getColumn(row, ['WORKZONE', 'STO']) || '') : '',
        STO: String(getColumn(row, isEbisUpload ? ['WORKZONE', 'STO'] : ['STO']) || ''),
      }));

      console.log('📊 TOTAL DATA DARI EXCEL:', json.length);
      console.log('📊 DATA TERUPLOAD:', rawData.length);

      setDataPerCategory((prev) => ({
        ...prev,
        [currentKey]: rawData,
      }));
      setFilteredDataPerCategory((prev) => ({
        ...prev,
        [currentKey]: rawData,
      }));

      alert(`✅ Berhasil! ${rawData.length} baris data dimuat (${file.name})`);
    } catch (error) {
      console.error('Error upload:', error);
      alert('❌ Gagal membaca file. Pastikan format file benar.');
    }
  };
  reader.readAsArrayBuffer(file);
};

  const processData = () => {
    const currentData = dataPerCategory[currentKey] || [];
    if (currentData.length === 0) {
      alert('⚠️ Upload file Excel dulu ya!');
      return;
    }

    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    const filtered = currentData.filter((row) => {
      const dateCreated = parseDate(row['DATECREATED']);
      if (!dateCreated) return false;
      let match = true;
      if (fromDate && isBefore(dateCreated, fromDate)) match = false;
      if (toDate && isAfter(dateCreated, toDate)) match = false;
      return match;
    });

    setFilteredDataPerCategory((prev) => ({
      ...prev,
      [currentKey]: filtered,
    }));

    alert(`✅ Filter berhasil! ${filtered.length} baris data.`);
  };

  const exportToPNG = async () => {
    const currentFiltered = filteredDataPerCategory[currentKey] || [];
    if (currentFiltered.length === 0) {
      alert('⚠️ Upload data dulu ya!');
      return;
    }

    try {
      const domtoimage = (await import('dom-to-image')).default;
      const tableContainer = document.querySelector('#table-container');
      if (!tableContainer) {
        alert('❌ Tabel tidak ditemukan!');
        return;
      }

      const dataUrl = await domtoimage.toPng(tableContainer, {
        quality: 1,
        bgcolor: '#ffffff',
        width: tableContainer.scrollWidth,
        height: tableContainer.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          overflow: 'visible',
        },
      });

      const link = document.createElement('a');
      link.download = `Report_Tabel_Area2_${format(new Date(), 'yyyyMMdd')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error export PNG:', error);
      alert('❌ Gagal mengexport tabel. Coba lagi!');
    }
  };

  // ✅ PAKE useMemo BIAR GA BERAT
  const commonProps = useMemo(() => ({
    data: dataPerCategory[currentKey] || [],
    filteredData: filteredDataPerCategory[currentKey] || [],
    setData: (newData: any[]) => {
      setDataPerCategory((prev) => ({ ...prev, [currentKey]: newData }));
    },
    setFilteredData: (newData: any[]) => {
      setFilteredDataPerCategory((prev) => ({ ...prev, [currentKey]: newData }));
    },
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    handleFileUpload,
    processData,
    exportToPNG,
  }), [currentKey, dataPerCategory, filteredDataPerCategory, dateFrom, dateTo]);

  return (
    <div className="flex min-h-screen bg-[#f3f6fa]">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
          className={`fixed lg:sticky top-0 z-50 transition-transform duration-300 h-screen shadow-[8px_0_30px_rgba(16,27,45,0.08)] ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } lg:translate-x-0`}
      >
        <Sidebar
          onSelectMenu={handleMenuSelect}
          activeMenu={activeMenu}
          activeSubMenu={activeSubMenu}
          activeSubSubMenu={activeSubSubMenu}
        />
      </div>

      <div className="flex-1 overflow-x-auto px-4 pb-10 pt-4 md:px-8 md:pb-14 md:pt-7">
        <div className="mx-auto max-w-[1480px]">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="fixed left-4 top-4 z-50 rounded-xl bg-[#17263d] p-3 text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-[#213651] lg:hidden"
          >
            {isSidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>

          <div className="relative mb-7 overflow-hidden rounded-2xl bg-[#17263d] px-6 py-7 text-white shadow-[0_16px_45px_rgba(23,38,61,0.16)] md:px-10 md:py-8">
            <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full border-[34px] border-cyan-400/10" />
            <div className="absolute bottom-[-100px] right-32 h-48 w-48 rounded-full border-[22px] border-white/5" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300">Operations Control Room</p>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Report Monitoring Order <span className="text-cyan-300">AREA 2</span>
                </h1>
                <p className="mt-2 text-sm text-slate-300">Pantau progres order dalam satu tampilan kerja.</p>
              </div>
              <div className="border-l border-white/15 pl-4 md:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Periode laporan</p>
                <p className="mt-1 text-sm font-semibold text-white">{format(new Date(), 'MMMM yyyy')}</p>
              </div>
            </div>
          </div>

          {activeMenu === 'executive-review' && (
            <TabelKosong title="Executive Review" />
          )}

          {activeSubSubMenu === 'indihome-ao' && (
            <TabelAOIndihome {...commonProps} />
          )}

          {activeSubSubMenu === 'indihome-pda' && (
            <TabelPDAIndihome {...commonProps} />
          )}

          {activeSubSubMenu?.startsWith('indibiz') && (
            <TabelKosong title="INDIBIZ" />
          )}

          {activeSubSubMenu === 'ebis-datin' && (
            <TabelEBIS
              filteredData={filteredDataPerCategory[currentKey] || []}
              title="DATIN"
              handleFileUpload={handleFileUpload}
            />
          )}

          {activeSubSubMenu === 'ebis-wifi' && (
            <TabelEBIS
              filteredData={filteredDataPerCategory[currentKey] || []}
              title="WIFI"
              handleFileUpload={handleFileUpload}
            />
          )}
        </div>
      </div>
    </div>
  );
}