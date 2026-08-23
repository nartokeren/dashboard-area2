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
// 3. FUNGSI UTAMA
// ============================================
export default function DashboardPage() {
  const [activeMenu, setActiveMenu] = useState<string>('daily-report');
  const [activeSubMenu, setActiveSubMenu] = useState<string>('indihome');
  const [activeSubSubMenu, setActiveSubSubMenu] = useState<string>('indihome-ao');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // STATE DATA PER SUB-SUB-MENU
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
  // 4. DEFAULT FILTER (BULAN INI)
  // ============================================
  useEffect(() => {
    const now = new Date();
    const firstDay = startOfMonth(now);
    setDateFrom(format(firstDay, 'yyyy-MM-dd'));
    setDateTo(format(now, 'yyyy-MM-dd'));
  }, []);

  // ============================================
  // 5. PARSE TANGGAL
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
  // 6. HANDLE MENU
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
    // Tutup sidebar setelah klik menu (di mobile)
    setIsSidebarOpen(false);
  };

  // ============================================
  // 7. KEY UNTUK AKTIF
  // ============================================
  const currentKey = activeSubSubMenu || 'indihome-ao';

  // ============================================
  // 8. UPLOAD & PROSES DATA
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

        setDataPerCategory((prev) => ({
          ...prev,
          [currentKey]: json,
        }));
        setFilteredDataPerCategory((prev) => ({
          ...prev,
          [currentKey]: json,
        }));

        alert(`✅ Berhasil! ${json.length} baris data dimuat.`);
      } catch (error) {
        alert('❌ Gagal membaca file. Pastikan format Excel benar.');
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
  // 9. TAMPILAN WEBSITE (HTML)
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

    {/* SIDEBAR - full height & sticky */}
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

        {/* KONTEN SESUAI MENU */}
        {activeMenu === 'executive-review' && (
          <TabelKosong title="Executive Review" />
        )}

        {activeMenu === 'daily-report' && activeSubSubMenu === 'indihome-ao' && (
          <TabelAOIndihome {...commonProps} />
        )}

        {activeMenu === 'daily-report' && activeSubSubMenu === 'indihome-pda' && (
          <TabelPDAIndihome {...commonProps} />
        )}

        {activeMenu === 'daily-report' && activeSubSubMenu?.startsWith('indibiz') && (
          <TabelKosong title="INDIBIZ" />
        )}

        {activeMenu === 'daily-report' && activeSubSubMenu?.startsWith('ebis') && (
          <TabelKosong title="EBIS" />
        )}
      </div>
    </div>
  </div>
);
}