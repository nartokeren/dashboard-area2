export type IndibizManjaCategory = 'MANJA EXP' | 'MANJA HI' | 'MANJA H+' | 'MANJA H++' | 'MANJA ANOMALY';

export const parseManjaDate = (value: unknown): Date | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const wholeDays = Math.floor(value);
    const fractionalDay = value - wholeDays;
    return new Date(1899, 11, 30 + wholeDays, 0, 0, 0, Math.round(fractionalDay * 86400000));
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value.trim()) return null;

  const text = value.trim();
  const localDateMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (localDateMatch) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = localDateMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
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

const hasExplicitTime = (value: unknown) => {
  if (typeof value === 'number') return value % 1 !== 0;
  if (value instanceof Date) {
    return value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0 || value.getMilliseconds() !== 0;
  }
  return typeof value === 'string' && /(?:T|\s)\d{1,2}:\d{2}/.test(value.trim());
};

export const getIndibizManjaCategory = (value: unknown, asOf: number): IndibizManjaCategory => {
  const manjaDate = parseManjaDate(value);
  if (!manjaDate || (
    manjaDate.getFullYear() === 1970 &&
    manjaDate.getMonth() === 0 &&
    manjaDate.getDate() === 1
  )) return 'MANJA ANOMALY';

  const reportDate = new Date(asOf);
  const manjaDay = Date.UTC(manjaDate.getFullYear(), manjaDate.getMonth(), manjaDate.getDate());
  const reportDay = Date.UTC(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
  const dayDifference = Math.round((manjaDay - reportDay) / 86400000);

  if (dayDifference < 0 || (dayDifference === 0 && hasExplicitTime(value) && manjaDate.getTime() < asOf)) {
    return 'MANJA EXP';
  }
  if (dayDifference === 0) return 'MANJA HI';
  if (dayDifference === 1) return 'MANJA H+';
  return 'MANJA H++';
};
