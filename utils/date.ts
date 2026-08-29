// ============================================
// EXCEL SERIAL NUMBER → DATE
// ============================================
export const excelSerialToDate = (num: number): Date => {
  const wholeDays = Math.floor(num);
  const fractionalDay = num - wholeDays;
  const totalSeconds = Math.round(fractionalDay * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return new Date(1899, 11, 30 + wholeDays, hours, minutes, seconds);
};

// ============================================
// PARSE DATE DARI BERBAGAI FORMAT
// ============================================
export const parseDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  if (typeof value === 'string') {
    // Coba parse sebagai string date
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    
    // Coba parse sebagai angka (Excel serial)
    const num = parseFloat(value);
    if (!isNaN(num)) return excelSerialToDate(num);
  }
  
  if (typeof value === 'number') {
    return excelSerialToDate(value);
  }
  
  return null;
};

// ============================================
// FORMAT DATE UNTUK DISPLAY
// ============================================
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatDateShort = (date: Date): string => {
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short'
  });
};