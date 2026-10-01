import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { addMappingColumns } from '@/constants/stoMapping';

export const downloadMappedExcel = (data: Record<string, unknown>[], fileName: string) => {
  if (data.length === 0) {
    alert('Tidak ada data upload untuk di-download.');
    return;
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(addMappingColumns(data));
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Upload');
  XLSX.writeFile(workbook, `${fileName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
};

// ============================================
// EXPORT PNG (pake dom-to-image)
// ============================================
export const exportPNG = async (elementId: string, fileName: string) => {
  try {
    const domtoimage = (await import('dom-to-image')).default;
    const element = document.getElementById(elementId);
    
    if (!element) {
      alert('❌ Elemen tidak ditemukan!');
      return;
    }

    // Sembunyikan tombol export di dalam elemen
    const exportButtons = element.querySelectorAll('[data-export-ignore="true"]');
    const originalDisplayStates = Array.from(exportButtons).map((btn: any) => ({
      element: btn,
      display: btn.style.display,
    }));
    
    exportButtons.forEach((btn: any) => {
      btn.style.display = 'none';
    });

    // Capture
    const dataUrl = await domtoimage.toPng(element, {
      quality: 1,
      bgcolor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
    });

    // Kembalikan tombol
    originalDisplayStates.forEach(({ element, display }) => {
      element.style.display = display;
    });

    // Download
    const link = document.createElement('a');
    link.download = `${fileName}_${format(new Date(), 'yyyyMMdd')}.png`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error export PNG:', error);
    alert('❌ Gagal mengexport gambar. Coba lagi!');
  }
};