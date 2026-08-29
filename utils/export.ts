import { format } from 'date-fns';

// ============================================
// DOWNLOAD CSV
// ============================================
export const downloadCSV = (data: any[], fileName: string) => {
  if (data.length === 0) {
    alert('⚠️ Tidak ada data untuk di-download!');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(h => `"${row[h] || ''}"`);
    csvRows.push(values.join(','));
  }
  
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}_${format(new Date(), 'yyyyMMdd')}.csv`;
  link.click();
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