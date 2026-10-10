import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { addMappingColumns } from '@/constants/stoMapping';
import { getIndibizManjaCategory } from '@/utils/manja';
import { parseDate } from '@/utils/date';

type DownloadClassification = 'indihome' | 'indibiz';

const normalizedColumn = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '_');

const getColumn = (row: Record<string, unknown>, name: string) => {
  const key = Object.keys(row).find((column) => normalizedColumn(column) === name);
  return key ? row[key] : null;
};

const isDateColumn = (header: string) => /(DATE|TGL|TANGGAL|TIME|JAM)/i.test(header);

const parseDownloadDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value < 2958466) {
    const wholeDays = Math.floor(value);
    const seconds = Math.round((value - wholeDays) * 86400);
    return new Date(1899, 11, 30 + wholeDays, 0, 0, seconds);
  }
  if (typeof value !== 'string' || !value.trim()) return null;

  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial >= 1 && serial < 2958466) {
      const wholeDays = Math.floor(serial);
      const seconds = Math.round((serial - wholeDays) * 86400);
      return new Date(1899, 11, 30 + wholeDays, 0, 0, seconds);
    }
  }
  const localDateMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (localDateMatch) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = localDateMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day) ||
      date.getHours() !== Number(hour) ||
      date.getMinutes() !== Number(minute) ||
      date.getSeconds() !== Number(second)
    ) return null;
    return date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hasTimeComponent = (value: unknown, date: Date, sourceUsesTimeFormat: boolean) => {
  if (sourceUsesTimeFormat) return true;
  if (typeof value === 'number') return Math.abs(value % 1) > 1e-8;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) return Math.abs(Number(text) % 1) > 1e-8;
    return /(?:T|\s)\d{1,2}:\d{2}/.test(text);
  }
  return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0;
};

const toExcelSerial = (date: Date) => (
  Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  ) / 86400000 + 25569
);

export const formatUploadedDateColumns = (
  worksheet: XLSX.WorkSheet,
  sourceRows: Record<string, unknown>[] = []
) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  const dateColumns = new Set<number>();

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const headerCell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })];
    if (headerCell && isDateColumn(String(headerCell.v ?? ''))) dateColumns.add(column);
  }

  for (const column of dateColumns) {
    for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address];
      if (!cell || cell.v === null || cell.v === undefined || cell.v === '') continue;

      const sourceValue: unknown = cell.v;
      const date = parseDownloadDate(sourceValue);
      if (!date) continue;

      cell.v = toExcelSerial(date);
      cell.t = 'n';
      const header = normalizedColumn(String(worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })]?.v ?? ''));
      const sourceRow = sourceRows[row - range.s.r - 1];
      const sourceTimeColumns = sourceRow?.__DATE_TIME_COLUMNS;
      const sourceUsesTimeFormat = Array.isArray(sourceTimeColumns) && sourceTimeColumns.includes(header);
      cell.z = hasTimeComponent(sourceValue, date, sourceUsesTimeFormat)
        ? 'dd/mm/yyyy hh:mm:ss'
        : 'dd/mm/yyyy';
    }
  }

  return worksheet;
};

const getIndihomeManjaCategory = (row: Record<string, unknown>, now: Date) => {
  const rawManjaDate = getColumn(row, 'TGL_MANJA') ?? getColumn(row, 'TANGGAL_MANJA');
  if (rawManjaDate === null || rawManjaDate === undefined || String(rawManjaDate).trim() === '') {
    return 'NON MANJA';
  }

  const manjaDate = parseDate(rawManjaDate);
  if (!manjaDate) return 'TANGGAL MANJA INVALID';

  const manjaDay = new Date(manjaDate.getFullYear(), manjaDate.getMonth(), manjaDate.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (manjaDay < today) return 'MANJA EXP';
  if (manjaDay === today) return 'MANJA HI';
  return 'MANJA H+';
};

const addDownloadClassifications = (
  rows: Record<string, unknown>[],
  classification: DownloadClassification,
  asOf: number
) => {
  const mappedRows = addMappingColumns(rows);

  return mappedRows.map((mappedRow, index) => {
    const sourceRow = rows[index];
    const status = String(getColumn(sourceRow, 'KELOMPOK_STATUS') ?? '').trim().toUpperCase();
    const resume = String(getColumn(sourceRow, 'STATUS_RESUME') ?? '').trim().toUpperCase();
    const columns = classification === 'indihome'
      ? {
          'KATEGORI MANJA': getIndihomeManjaCategory(sourceRow, new Date(asOf)),
        }
      : {
          'STATUS SURVEY': status === 'SURVEY_NEW_MANJA'
            ? resume.includes('INVALID') ? 'INVALID SURVEY' : 'SURVEY OPEN'
            : '',
          'KATEGORI MANJA': status === 'SURVEY_NEW_MANJA'
            ? getIndibizManjaCategory(getColumn(sourceRow, 'TGL_MANJA'), asOf)
            : '',
          'AGING PI': status === 'PI'
            ? (() => {
                const orderDate = parseDate(getColumn(sourceRow, 'ORDER_DATE'));
                if (!orderDate) return 'TANGGAL ORDER INVALID';
                const ageDays = Math.max(0, (asOf - orderDate.getTime()) / 86400000);
                if (ageDays < 1) return '<1 Hari';
                if (ageDays < 3) return '1-2 Hari';
                return '>3 Hari';
              })()
            : '',
        };

    const [branch, region, serviceArea, ...uploadedFields] = Object.entries(mappedRow);
    const classificationNames = new Set(Object.keys(columns).map(normalizedColumn));
    const outputRow = Object.fromEntries([
      branch,
      region,
      serviceArea,
      ...Object.entries(columns),
      ...uploadedFields.filter(([header]) => !classificationNames.has(normalizedColumn(header))),
    ]);
    return outputRow;
  });
};

export const downloadMappedExcel = (
  data: Record<string, unknown>[],
  fileName: string,
  classification?: DownloadClassification,
  asOf = Date.now()
) => {
  if (data.length === 0) {
    alert('Tidak ada data upload untuk di-download.');
    return;
  }

  const workbook = XLSX.utils.book_new();
  const exportRows = classification
    ? addDownloadClassifications(data, classification, asOf)
    : addMappingColumns(data);
  const worksheet = formatUploadedDateColumns(XLSX.utils.json_to_sheet(exportRows), data);
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