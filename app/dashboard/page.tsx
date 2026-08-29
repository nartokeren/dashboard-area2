'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, isBefore, isAfter } from 'date-fns';
import { FaBars, FaTimes } from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import TabelAOIndihome from '../components/TabelAOIndihome';
import TabelPDAIndihome from '../components/TabelPDAIndihome';
import TabelKosong from '../components/TabelKosong';

// ============================================
// 1. MAPPING REGIONAL & TARGET
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
// 2. FUNGSI UTAMA
// ============================================
export default function DashboardPage() {
  const [activeMenu, setActiveMenu] = useState<string>('daily-report');
  const [activeSubMenu, setActiveSubMenu] = useState<string>('indihome');
  const [activeSubSubMenu, setActiveSubSubMenu] = useState<string>('indihome-ao');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ============================================
  // 3. STATE DATA PER SUB-SUB-MENU
  // ============================================
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

  // ============================================
  // 4. DEFAULT FILTER (TIDAK ADA BATAS BULAN)
  // ============================================
  useEffect(() => {
    setDateFrom('');
    setDateTo('');
  }, []);

  // ============================================
  // 5. PARSE TANGGAL (Excel Serial Number + String)
  // ============================================
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

  // ============================================
  // 6. KEY UNTUK AKTIF
  // ============================================
  const currentKey = activeSubSubMenu || 'indihome-ao';

  // ============================================
  // 7. HANDLE MENU
  // ============================================
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

    // ============================================
  // 8. UPLOAD FILE (FILTER BULAN INI)
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

        // 🔥 AMBIL 11 KOLOM
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

        // 🔥 SEMUA DATA YANG TERUPLOAD HARUS TAMPIL TANPA BATAS BULAN
        const filteredData = rawData;

        console.log('📊 TOTAL DATA DARI EXCEL:', json.length);
        console.log('📊 DATA TERUPLOAD:', filteredData.length);
        console.log('📊 SAMPLE DATE:', filteredData.slice(0, 3).map((row: any) => row.DATECREATED));

        setDataPerCategory((prev) => ({
          ...prev,
          [currentKey]: filteredData,
        }));
        setFilteredDataPerCategory((prev) => ({
          ...prev,
          [currentKey]: filteredData,
        }));

        alert(`✅ Berhasil! ${filteredData.length} baris data dimuat dari file Excel.`);
      } catch (error) {
        console.error('Error upload:', error);
        alert('❌ Gagal membaca file. Pastikan format Excel benar.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ============================================
  // 9. PROSES DATA (FILTER)
  // ============================================
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

  // ============================================
  // 10. EXPORT PNG
  // ============================================
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

  // ============================================
  // 11. PROPS YANG DIKIRIM KE KOMPONEN
  // ============================================
  const commonProps = {
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
  };

  // ============================================
  // 12. TAMPILAN WEBSITE (HTML)
  // ============================================
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
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

      {/* KONTEN UTAMA */}
      <div className="flex-1 p-4 md:p-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto">
          {/* TOMBOL HAMBURGER */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden fixed top-4 left-4 z-50 bg-slate-800 text-white p-2 rounded-lg shadow-lg hover:bg-slate-700 transition-colors"
          >
            {isSidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>

          {/* HEADER */}
          <div className="bg-slate-800 text-white p-4 md:p-6 rounded-lg shadow-lg mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-center">
              Report Monitoring Order AREA 2
            </h1>
            <p className="text-center text-slate-300 text-sm mt-1">
              Periode: {format(new Date(), 'MMMM yyyy')}
            </p>
          </div>

          {/* LANDING PAGE (Executive Review) */}
          {activeMenu === 'executive-review' && (
            <TabelKosong title="Executive Review" />
          )}

          {/* DAILY REPORT - INDIHOME AO */}
          {activeSubSubMenu === 'indihome-ao' && (
            <TabelAOIndihome {...commonProps} />
          )}

          {/* DAILY REPORT - INDIHOME PDA */}
          {activeSubSubMenu === 'indihome-pda' && (
            <TabelPDAIndihome {...commonProps} />
          )}

          {/* DAILY REPORT - INDIBIZ (Coming Soon) */}
          {activeSubSubMenu?.startsWith('indibiz') && (
            <TabelKosong title="INDIBIZ" />
          )}

          {/* DAILY REPORT - EBIS (Coming Soon) */}
          {activeSubSubMenu?.startsWith('ebis') && (
            <TabelKosong title="EBIS" />
          )}
        </div>
      </div>
    </div>
  );
}