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
    'ebis-ao',
    'ebis-pda',
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
      else if (subMenuId === 'ebis') setActiveSubSubMenu('ebis-ao');
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

      // STEP 4: Ambil sheet pertama
      const sheet = fileToProcess.Sheets[fileToProcess.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      // STEP 5: Mapping data
      const rawData = json.map((row: any) => ({
        WONUM: String(row['WONUM'] || ''),
        STATUS: String(row['STATUS'] || ''),
        DATECREATED: row['DATECREATED'] || null,
        STATUSDATE: row['STATUSDATE'] || null,
        DISTRICT_TIF: String(row['DISTRICT_TIF'] || ''),
        TGL_MANJA: row['TGL_MANJA'] || null,
        ERRORCODE_AKHIR: String(row['ERRORCODE_AKHIR'] || ''),
        SUBERRORCODE_AKHIR: String(row['SUBERRORCODE_AKHIR'] || ''),
        STO: String(row['STO'] || ''),
        SCID: String(row['SCID'] || ''),
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
    <div className="flex min-h-screen bg-slate-50">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed lg:sticky top-0 z-50 transition-transform duration-300 h-screen ${
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

      <div className="flex-1 p-4 md:p-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden fixed top-4 left-4 z-50 bg-slate-800 text-white p-2 rounded-lg shadow-lg hover:bg-slate-700 transition-colors"
          >
            {isSidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>

          <div className="bg-slate-800 text-white p-4 md:p-6 rounded-lg shadow-lg mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-center">
              Report Monitoring Order AREA 2
            </h1>
            <p className="text-center text-slate-300 text-sm mt-1">
              Periode: {format(new Date(), 'MMMM yyyy')}
            </p>
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

          {activeSubSubMenu?.startsWith('ebis') && (
            <TabelKosong title="EBIS" />
          )}
        </div>
      </div>
    </div>
  );
}