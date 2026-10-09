'use client';

import { useMemo, useState } from 'react';
import { FaCopy, FaDownload, FaFileExcel } from 'react-icons/fa';
import { getStoCode, stoMapping } from '@/constants/stoMapping';

interface IndibizRow {
  [key: string]: unknown;
}

type ManjaCategory = 'exp' | 'hi' | 'hPlus' | 'hPlusPlus' | 'anomaly';
type ManjaCounts = Record<ManjaCategory, number>;

interface TabelIndibizProps {
  rows: IndibizRow[];
  asOf: number;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface ReportCounts {
  segments: Record<'DGS' | 'DPS' | 'DSS' | 'REG', number>;
  surveyOpen: ManjaCounts;
  totalSurveyOpen: number;
  invalidSurvey: ManjaCounts;
  totalInvalidSurvey: number;
  piUnderOneDay: number;
  piOneToTwoDays: number;
  piOverThreeDays: number;
  totalPi: number;
  falloutCustomer: number;
  falloutTechnical: number;
  falloutOther: number;
  totalFallout: number;
  actcomp: number;
  falloutNonWfm: number;
  ps: number;
}

interface BranchReport {
  region: string;
  branch: string;
  counts: ReportCounts;
}

interface RegionalReport {
  region: string;
  branches: BranchReport[];
  counts: ReportCounts;
}

const includedStatuses = new Set([
  'ACT_COM',
  'CANCEL',
  'FO_UIM',
  'FO_ASAP',
  'FO_OSM',
  'FO_WFM',
  'PI',
  'PS',
  'REVOKE',
  'SURVEY_NEW_MANJA',
]);

const createManjaCounts = (): ManjaCounts => ({
  exp: 0,
  hi: 0,
  hPlus: 0,
  hPlusPlus: 0,
  anomaly: 0,
});

const createCounts = (): ReportCounts => ({
  segments: { DGS: 0, DPS: 0, DSS: 0, REG: 0 },
  surveyOpen: createManjaCounts(),
  totalSurveyOpen: 0,
  invalidSurvey: createManjaCounts(),
  totalInvalidSurvey: 0,
  piUnderOneDay: 0,
  piOneToTwoDays: 0,
  piOverThreeDays: 0,
  totalPi: 0,
  falloutCustomer: 0,
  falloutTechnical: 0,
  falloutOther: 0,
  totalFallout: 0,
  actcomp: 0,
  falloutNonWfm: 0,
  ps: 0,
});

const normalizedColumn = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '_');

const readColumn = (row: IndibizRow, name: string): unknown => {
  const key = Object.keys(row).find((column) => normalizedColumn(column) === name);
  return key ? row[key] : null;
};

const parseOrderDate = (value: unknown): Date | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date((value - 25569) * 86400000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const parseManjaDate = (value: unknown): Date | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const wholeDays = Math.floor(value);
    const fractionalDay = value - wholeDays;
    const seconds = Math.round(fractionalDay * 86400);
    return new Date(1899, 11, 30 + wholeDays, 0, 0, seconds);
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
      date.getDate() !== Number(day)
    ) return null;
    return date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatManjaDate = (value: unknown) => {
  const date = parseManjaDate(value);
  if (!date || (
    date.getFullYear() === 1970 &&
    date.getMonth() === 0 &&
    date.getDate() === 1
  )) return 'MANJA ANOMALY';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const getOrderAgeCategory = (value: unknown, asOf: number) => {
  const orderDate = parseOrderDate(value);
  if (!orderDate) return 'TANGGAL ORDER INVALID';

  const ageDays = Math.max(0, (asOf - orderDate.getTime()) / 86400000);
  if (ageDays < 1) return '<1 Hari';
  if (ageDays < 3) return '1-2 Hari';
  return '>3 Hari';
};

const getManjaCategory = (value: unknown, asOf: number): ManjaCategory => {
  const manjaDate = parseManjaDate(value);
  if (!manjaDate || (
    manjaDate.getFullYear() === 1970 &&
    manjaDate.getMonth() === 0 &&
    manjaDate.getDate() === 1
  )) return 'anomaly';

  const reportDate = new Date(asOf);
  const manjaDay = Date.UTC(manjaDate.getFullYear(), manjaDate.getMonth(), manjaDate.getDate());
  const reportDay = Date.UTC(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
  const dayDifference = Math.round((manjaDay - reportDay) / 86400000);

  if (dayDifference < 0) return 'exp';
  if (dayDifference === 0) return 'hi';
  if (dayDifference === 1) return 'hPlus';
  return 'hPlusPlus';
};

const getSegment = (provider: unknown): keyof ReportCounts['segments'] => {
  const prefix = String(provider ?? '').trim().toUpperCase().split(/[-\s]/, 1)[0];
  if (prefix === 'DGS' || prefix === 'DPS' || prefix === 'DSS') return prefix;
  return 'REG';
};

const mergeCounts = (target: ReportCounts, source: ReportCounts) => {
  (['DGS', 'DPS', 'DSS', 'REG'] as const).forEach((segment) => {
    target.segments[segment] += source.segments[segment];
  });
  (['exp', 'hi', 'hPlus', 'hPlusPlus', 'anomaly'] as const).forEach((category) => {
    target.surveyOpen[category] += source.surveyOpen[category];
    target.invalidSurvey[category] += source.invalidSurvey[category];
  });
  target.totalSurveyOpen += source.totalSurveyOpen;
  target.totalInvalidSurvey += source.totalInvalidSurvey;
  target.piUnderOneDay += source.piUnderOneDay;
  target.piOneToTwoDays += source.piOneToTwoDays;
  target.piOverThreeDays += source.piOverThreeDays;
  target.totalPi += source.totalPi;
  target.falloutCustomer += source.falloutCustomer;
  target.falloutTechnical += source.falloutTechnical;
  target.falloutOther += source.falloutOther;
  target.totalFallout += source.totalFallout;
  target.actcomp += source.actcomp;
  target.falloutNonWfm += source.falloutNonWfm;
  target.ps += source.ps;
};

const formatPercent = (ps: number, totalPi: number, totalFallout: number, actcomp: number) => {
  const denominator = totalPi + totalFallout + actcomp + ps;
  return denominator === 0 ? '0.00%' : `${((ps / denominator) * 100).toFixed(2)}%`;
};

const meetsTarget = (ps: number, totalPi: number, totalFallout: number, actcomp: number) => {
  const denominator = totalPi + totalFallout + actcomp + ps;
  return denominator > 0 && (ps / denominator) * 100 >= 95;
};

const manjaCategoryStyles: Record<ManjaCategory, { label: string; cell: string; header: string }> = {
  exp: {
    label: 'MANJA EXP',
    cell: 'bg-red-50 text-red-700',
    header: 'border-red-200 bg-red-100 text-red-800',
  },
  hi: {
    label: 'MANJA HI',
    cell: 'bg-amber-50 text-amber-800',
    header: 'border-amber-200 bg-amber-100 text-amber-900',
  },
  hPlus: {
    label: 'MANJA H+',
    cell: 'bg-amber-50 text-amber-800',
    header: 'border-amber-200 bg-amber-100 text-amber-900',
  },
  hPlusPlus: {
    label: 'MANJA H++',
    cell: 'bg-emerald-50 text-emerald-700',
    header: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  },
  anomaly: {
    label: 'MANJA ANOMALY',
    cell: 'bg-emerald-50 text-emerald-700',
    header: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  },
};

const provisioningStyles = {
  lessThanOne: {
    cell: 'bg-emerald-50 text-emerald-700',
    header: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  },
  oneToTwo: {
    cell: 'bg-amber-50 text-amber-800',
    header: 'border-amber-200 bg-amber-100 text-amber-900',
  },
  moreThanThree: {
    cell: 'bg-red-50 text-red-700',
    header: 'border-red-200 bg-red-100 text-red-800',
  },
};

const CountCell = ({ value, className = '' }: { value: number; className?: string }) => (
  <td className={`border border-slate-200 px-2.5 py-2 text-center tabular-nums ${className}`}>{value}</td>
);

const ReportDataCells = ({
  counts,
  subtotal = false,
  grandTotal = false,
}: {
  counts: ReportCounts;
  subtotal?: boolean;
  grandTotal?: boolean;
}) => {
  const bandClass = grandTotal
    ? 'border-slate-700 bg-slate-900 font-bold text-white'
    : subtotal
      ? 'bg-blue-100 font-semibold text-blue-800'
      : '';
  const cell = (value: number, key: string, color = '') => (
    <CountCell
      key={key}
      value={value}
      className={`${subtotal || grandTotal ? '' : color} ${bandClass}`}
    />
  );
  const achieved = meetsTarget(counts.ps, counts.totalPi, counts.totalFallout, counts.actcomp);

  return (
    <>
      {(['DGS', 'DPS', 'DSS', 'REG'] as const).map((segment) =>
        cell(counts.segments[segment], `segment-${segment}`)
      )}
      {(['exp', 'hi', 'hPlus', 'hPlusPlus', 'anomaly'] as const).map((category) =>
        cell(counts.surveyOpen[category], `open-${category}`, subtotal ? '' : manjaCategoryStyles[category].cell)
      )}
      {cell(counts.totalSurveyOpen, 'total-survey-open')}
      {(['exp', 'hi', 'hPlus', 'hPlusPlus', 'anomaly'] as const).map((category) =>
        cell(counts.invalidSurvey[category], `invalid-${category}`, subtotal ? '' : manjaCategoryStyles[category].cell)
      )}
      {cell(counts.totalInvalidSurvey, 'total-invalid-survey')}
      {cell(counts.piUnderOneDay, 'pi-under-one', subtotal ? '' : provisioningStyles.lessThanOne.cell)}
      {cell(counts.piOneToTwoDays, 'pi-one-to-two', subtotal ? '' : provisioningStyles.oneToTwo.cell)}
      {cell(counts.piOverThreeDays, 'pi-over-three', subtotal ? '' : provisioningStyles.moreThanThree.cell)}
      {cell(counts.totalPi, 'total-pi')}
      {cell(counts.falloutCustomer, 'fallout-customer')}
      {cell(counts.falloutTechnical, 'fallout-technical')}
      {cell(counts.falloutOther, 'fallout-other')}
      {cell(counts.falloutNonWfm, 'fallout-non-wfm')}
      {cell(counts.totalFallout, 'total-fallout')}
      {cell(counts.actcomp, 'actcomp')}
      {cell(counts.ps, 'total-ps')}
      <td className={`border border-slate-200 px-2 py-1.5 text-center font-semibold tabular-nums ${
        grandTotal
          ? 'border-slate-700 bg-slate-900 text-white'
          : subtotal
            ? 'bg-blue-100 text-blue-800'
            : achieved
              ? 'text-emerald-700'
              : 'text-rose-700'
      }`}>
        {formatPercent(counts.ps, counts.totalPi, counts.totalFallout, counts.actcomp)}
      </td>
    </>
  );
};

export default function TabelIndibiz({ rows, asOf, handleFileUpload }: TabelIndibizProps) {
  const [copyFeedback, setCopyFeedback] = useState('Salin summary');
  const [surveyDetailCopyFeedback, setSurveyDetailCopyFeedback] = useState('Salin detail');
  const [piDetailCopyFeedback, setPiDetailCopyFeedback] = useState('Salin detail');
  const reportRows = useMemo(() => {
    const groups = new Map<string, BranchReport>();

    rows.forEach((row) => {
      const status = String(readColumn(row, 'KELOMPOK_STATUS') ?? '').trim().toUpperCase();
      if (!includedStatuses.has(status)) return;

      const sto = getStoCode(row);
      const location = stoMapping[sto];
      const region = location?.regional || `UNKNOWN (${sto || 'STO'})`;
      const branch = location?.branch || `UNKNOWN (${sto || 'STO'})`;
      const key = `${region}\u0000${branch}`;
      let report = groups.get(key);
      if (!report) {
        report = { region, branch, counts: createCounts() };
        groups.set(key, report);
      }

      const counts = report.counts;
      counts.segments[getSegment(readColumn(row, 'PROVIDER'))] += 1;

      if (status === 'SURVEY_NEW_MANJA') {
        const resume = String(readColumn(row, 'STATUS_RESUME') ?? '');
        const category = getManjaCategory(readColumn(row, 'TGL_MANJA'), asOf);
        if (resume.toUpperCase().includes('INVALID')) {
          counts.invalidSurvey[category] += 1;
          counts.totalInvalidSurvey += 1;
        } else {
          counts.surveyOpen[category] += 1;
          counts.totalSurveyOpen += 1;
        }
      } else if (status === 'PI') {
        counts.totalPi += 1;
        const orderDate = parseOrderDate(readColumn(row, 'ORDER_DATE'));
        const ageDays = orderDate ? Math.max(0, (asOf - orderDate.getTime()) / 86400000) : null;
        const ageCategory = getOrderAgeCategory(readColumn(row, 'ORDER_DATE'), asOf);
        if (ageCategory === '<1 Hari') counts.piUnderOneDay += 1;
        else if (ageCategory === '1-2 Hari') counts.piOneToTwoDays += 1;
        else if (ageDays !== null) counts.piOverThreeDays += 1;
      } else if (status === 'FO_WFM') {
        const hindrance = String(readColumn(row, 'KELOMPOK_KENDALA') ?? '').trim().toUpperCase();
        if (hindrance === 'KENDALA PELANGGAN') counts.falloutCustomer += 1;
        else if (hindrance === 'KENDALA TEKNIK') counts.falloutTechnical += 1;
        else counts.falloutOther += 1;
        counts.totalFallout += 1;
      } else if (status === 'ACT_COM') {
        counts.actcomp += 1;
      } else if (status === 'FO_UIM' || status === 'FO_ASAP' || status === 'FO_OSM') {
        counts.falloutNonWfm += 1;
        counts.totalFallout += 1;
      } else if (status === 'PS') {
        counts.ps += 1;
      }
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.region.localeCompare(b.region) || a.branch.localeCompare(b.branch)
    );
  }, [asOf, rows]);

  const totals = useMemo(
    () => reportRows.reduce((result, row) => {
      mergeCounts(result, row.counts);
      return result;
    }, createCounts()),
    [reportRows]
  );

  const regionalRows = useMemo(() => {
    const groups = new Map<string, RegionalReport>();
    reportRows.forEach((row) => {
      let group = groups.get(row.region);
      if (!group) {
        group = { region: row.region, branches: [], counts: createCounts() };
        groups.set(row.region, group);
      }
      group.branches.push(row);
      mergeCounts(group.counts, row.counts);
    });
    return Array.from(groups.values());
  }, [reportRows]);

  const summaryRows = useMemo(
    () => [...reportRows].sort((a, b) =>
      a.branch.localeCompare(b.branch) || a.region.localeCompare(b.region)
    ),
    [reportRows]
  );

  const textSummary = useMemo(() => [
    'BRANCH / SURVEY OPEN / INVALID SURVEY / PI / FALLOUT / PS/PI (%)',
    ...summaryRows.map(({ branch, counts }) =>
      `${branch} / ${counts.totalSurveyOpen} / ${counts.totalInvalidSurvey} / ${counts.totalPi} / ${counts.totalFallout} / ${formatPercent(counts.ps, counts.totalPi, counts.totalFallout, counts.actcomp)}`
    ),
  ].join('\n'), [summaryRows]);

  const surveyOpenDetails = useMemo(() => {
    const details = rows
      .filter((row) =>
        String(readColumn(row, 'KELOMPOK_STATUS') ?? '').trim().toUpperCase() === 'SURVEY_NEW_MANJA' &&
        !String(readColumn(row, 'STATUS_RESUME') ?? '').toUpperCase().includes('INVALID')
      )
      .map((row) => {
        const sto = getStoCode(row);
        const mapping = stoMapping[sto];
        const branch = mapping?.branch || `UNKNOWN (${sto || 'STO'})`;
        const serviceArea = mapping?.serviceArea || 'UNKNOWN';
        const orderId = String(readColumn(row, 'ORDER_ID') ?? '').trim() || '-';
        const manjaDate = formatManjaDate(readColumn(row, 'TGL_MANJA'));
        return { branch, serviceArea, orderId, manjaDate };
      })
      .sort((a, b) =>
        a.branch.localeCompare(b.branch) ||
        a.serviceArea.localeCompare(b.serviceArea) ||
        a.orderId.localeCompare(b.orderId)
      );

    return [
      '*DETAIL ORDER SURVEY OPEN INDIBIZ*',
      '',
      'BRANCH / SERVICE AREA / ORDER ID / TANGGAL MANJA',
      ...details.map(({ branch, serviceArea, orderId, manjaDate }) =>
        `${branch} / ${serviceArea} / ${orderId} / ${manjaDate}`
      ),
    ].join('\n');
  }, [rows]);

  const provisioningDetails = useMemo(() => {
    const details = rows
      .filter((row) =>
        String(readColumn(row, 'KELOMPOK_STATUS') ?? '').trim().toUpperCase() === 'PI'
      )
      .map((row) => {
        const sto = getStoCode(row);
        const mapping = stoMapping[sto];
        const branch = mapping?.branch || `UNKNOWN (${sto || 'STO'})`;
        const serviceArea = mapping?.serviceArea || 'UNKNOWN';
        const orderId = String(readColumn(row, 'ORDER_ID') ?? '').trim() || '-';
        const ageCategory = getOrderAgeCategory(readColumn(row, 'ORDER_DATE'), asOf);
        return { branch, serviceArea, orderId, ageCategory };
      })
      .sort((a, b) =>
        a.branch.localeCompare(b.branch) ||
        a.serviceArea.localeCompare(b.serviceArea) ||
        a.orderId.localeCompare(b.orderId)
      );

    return [
      '*DETAIL ORDER PROVISIONING ISSUED INDIBIZ*',
      '',
      'BRANCH / SERVICE AREA / ORDER ID / KAT. USIA ORDER',
      ...details.map(({ branch, serviceArea, orderId, ageCategory }) =>
        `${branch} / ${serviceArea} / ${orderId} / ${ageCategory}`
      ),
    ].join('\n');
  }, [asOf, rows]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(textSummary);
      setCopyFeedback('Summary tersalin');
      window.setTimeout(() => setCopyFeedback('Salin summary'), 2000);
    } catch (error) {
      console.error('Error menyalin summary INDIBIZ:', error);
      setCopyFeedback('Gagal menyalin');
    }
  };

  const copySurveyOpenDetails = async () => {
    try {
      await navigator.clipboard.writeText(surveyOpenDetails);
      setSurveyDetailCopyFeedback('Detail tersalin');
      window.setTimeout(() => setSurveyDetailCopyFeedback('Salin detail'), 2000);
    } catch (error) {
      console.error('Error menyalin detail Survey Open INDIBIZ:', error);
      setSurveyDetailCopyFeedback('Gagal menyalin');
    }
  };

  const copyProvisioningDetails = async () => {
    try {
      await navigator.clipboard.writeText(provisioningDetails);
      setPiDetailCopyFeedback('Detail tersalin');
      window.setTimeout(() => setPiDetailCopyFeedback('Salin detail'), 2000);
    } catch (error) {
      console.error('Error menyalin detail Provisioning Issued INDIBIZ:', error);
      setPiDetailCopyFeedback('Gagal menyalin');
    }
  };

  const exportPng = async () => {
    const section = document.getElementById('indibiz-report-table');
    if (!section) {
      alert('Tabel report INDIBIZ tidak ditemukan.');
      return;
    }

    const tableScrollContainer = section.querySelector<HTMLElement>('[data-indibiz-table-scroll]');
    const table = section.querySelector('table');
    const width = Math.max(section.scrollWidth, table?.scrollWidth || 0);
    const height = section.scrollHeight;
    const previousOverflowX = tableScrollContainer?.style.overflowX;
    const previousWidth = section.style.width;
    const previousMinWidth = section.style.minWidth;
    const stickyElements = Array.from(section.querySelectorAll<HTMLElement>('.sticky'));
    const stickyStyles = stickyElements.map((element) => ({
      element,
      position: element.style.position,
      left: element.style.left,
      zIndex: element.style.zIndex,
    }));

    try {
      const domtoimage = (await import('dom-to-image')).default;
      if (tableScrollContainer) tableScrollContainer.style.overflowX = 'visible';
      section.style.width = `${width}px`;
      section.style.minWidth = `${width}px`;
      stickyStyles.forEach(({ element }) => {
        element.style.position = 'static';
        element.style.left = 'auto';
        element.style.zIndex = 'auto';
      });

      const svgDataUrl = await domtoimage.toSvg(section, {
        bgcolor: '#ffffff',
        width,
        height,
        style: {
          overflow: 'visible',
          width: `${width}px`,
          minWidth: `${width}px`,
          maxWidth: 'none',
        },
      });
      const image = new Image();
      image.src = svgDataUrl;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Tidak dapat membuat canvas untuk export PNG.');
      context.scale(2, 2);
      context.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.download = `Report_INDIBIZ_AO_PDA_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error export INDIBIZ PNG:', error);
      alert('Gagal mengexport tabel INDIBIZ ke PNG. Coba lagi.');
    } finally {
      if (tableScrollContainer && previousOverflowX !== undefined) {
        tableScrollContainer.style.overflowX = previousOverflowX;
      }
      section.style.width = previousWidth;
      section.style.minWidth = previousMinWidth;
      stickyStyles.forEach(({ element, position, left, zIndex }) => {
        element.style.position = position;
        element.style.left = left;
        element.style.zIndex = zIndex;
      });
    }
  };

  const uploadControl = (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-cyan-700 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-800 focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2">
      <FaFileExcel aria-hidden="true" />
      Import Excel
      <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} className="hidden" />
    </label>
  );

  return (
    <section className="mt-4 min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_35px_rgba(23,38,61,0.06)] md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700">Daily report / INDIBIZ</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">AO+PDA · Progress Order</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Kategori yang ditandai “abaikan” tidak disertakan dalam report.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {uploadControl}
          {reportRows.length > 0 && (
            <button
              type="button"
              onClick={exportPng}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
            >
              <FaDownload aria-hidden="true" />
              Export PNG
            </button>
          )}
        </div>
      </div>

      {reportRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">Belum ada data report</p>
          <p className="mt-1 text-xs text-slate-500">Upload file Excel INDIBIZ untuk membentuk tabel dan ringkasan.</p>
        </div>
      ) : (
        <div className="space-y-5">
        <div id="indibiz-report-table" className="min-w-0 bg-white font-sans">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700">INDIBIZ · AO+PDA</p>
              <h3 className="mt-1 text-sm font-bold text-slate-800">Progress order per branch</h3>
            </div>
            <p className="text-[11px] text-slate-500">Aging PI berdasarkan ORDER_DATE · Target PS/PI 95%</p>
          </div>
          <div data-indibiz-table-scroll className="overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-max min-w-full border-collapse text-[11px] leading-4 text-slate-700">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th rowSpan={3} className="sticky left-0 z-20 min-w-28 border border-slate-600 bg-slate-900 px-3 py-3 text-left font-semibold tracking-wide">REGION</th>
                <th rowSpan={3} className="sticky left-28 z-20 min-w-32 border border-slate-600 bg-slate-900 px-3 py-3 text-left font-semibold tracking-wide">BRANCH</th>
                <th colSpan={25} className="border border-slate-600 px-3 py-3 text-center font-bold tracking-[0.12em]">ON PROGRESS ORDER</th>
                <th rowSpan={3} className="min-w-20 border border-slate-600 px-2 py-3 font-semibold leading-tight">ACTCOMP<br />(QC2)</th>
                <th rowSpan={3} className="min-w-20 border border-slate-600 px-2 py-3 font-semibold leading-tight">JUMLAH<br />PS</th>
                <th rowSpan={3} className="min-w-24 border border-slate-600 px-2 py-3 font-semibold leading-tight">PS/PI (%)<br /><span className="text-[9px] font-medium text-slate-300">TARGET 95%</span></th>
              </tr>
              <tr className="bg-slate-800 text-white">
                <th colSpan={4} className="border border-slate-600 px-2 py-2.5 text-center font-semibold">SEGMENT ORDER</th>
                <th colSpan={6} className="border border-slate-600 px-2 py-2.5 text-center font-semibold">SURVEY OPEN</th>
                <th colSpan={6} className="border border-slate-600 px-2 py-2.5 text-center font-semibold">INVALID SURVEY</th>
                <th colSpan={4} className="border border-slate-600 px-2 py-2.5 text-center font-semibold">PROVISIONING ISSUED</th>
                <th colSpan={5} className="border border-slate-600 px-2 py-2.5 text-center font-semibold">ORDER FALLOUT</th>
              </tr>
              <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {(['DGS', 'DPS', 'DSS', 'REG'] as const).map((heading) => (
                  <th key={heading} className="min-w-12 border border-slate-200 px-2 py-2.5">{heading}</th>
                ))}
                {(['exp', 'hi', 'hPlus', 'hPlusPlus', 'anomaly'] as const).map((category) => (
                  <th key={`open-${category}`} className={`w-[68px] min-w-[68px] whitespace-normal break-words border px-1.5 py-2.5 leading-tight ${manjaCategoryStyles[category].header}`}>
                    {manjaCategoryStyles[category].label}
                  </th>
                ))}
                <th className="w-[68px] min-w-[68px] whitespace-normal break-words border border-slate-200 bg-cyan-50 px-1.5 py-2.5 leading-tight text-cyan-900">TOTAL<br />SURVEY OPEN</th>
                {(['exp', 'hi', 'hPlus', 'hPlusPlus', 'anomaly'] as const).map((category) => (
                  <th key={`invalid-${category}`} className={`w-[68px] min-w-[68px] whitespace-normal break-words border px-1.5 py-2.5 leading-tight ${manjaCategoryStyles[category].header}`}>
                    {manjaCategoryStyles[category].label}
                  </th>
                ))}
                <th className="w-[68px] min-w-[68px] whitespace-normal break-words border border-slate-200 bg-cyan-50 px-1.5 py-2.5 leading-tight text-cyan-900">TOTAL<br />INVALID SURVEY</th>
                <th className={`min-w-14 border px-2 py-2.5 ${provisioningStyles.lessThanOne.header}`}>&lt;1 Hari</th>
                <th className={`min-w-14 border px-2 py-2.5 ${provisioningStyles.oneToTwo.header}`}>1-2 Hari</th>
                <th className={`min-w-14 border px-2 py-2.5 ${provisioningStyles.moreThanThree.header}`}>&gt;3 Hari</th>
                {['TOTAL PI', 'KEND. PELANGGAN', 'KEND. TEKNIS', 'KEND. LAINNYA', 'FALLOUT NON WFM', 'TOTAL FALLOUT'].map((heading) => (
                  <th
                    key={heading}
                    className={`border border-slate-200 bg-slate-50 px-2 py-2 ${
                      heading === 'TOTAL PI'
                        ? 'min-w-14'
                        : 'w-[68px] min-w-[68px] whitespace-normal break-words px-1.5 py-2.5 leading-tight'
                    }`}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regionalRows.flatMap((regional) => [
                ...regional.branches.map((row, index) => (
                  <tr key={`${regional.region}-${row.branch}`} className="transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-cyan-50/60">
                    {index === 0 && (
                      <td
                        rowSpan={regional.branches.length + 1}
                        className="sticky left-0 z-10 min-w-28 border border-slate-200 bg-blue-50 px-3 py-2 text-left align-middle font-semibold text-slate-700"
                      >
                        {regional.region}
                      </td>
                    )}
                    <td className="sticky left-28 z-10 min-w-32 border border-slate-200 bg-inherit px-3 py-2 font-medium text-slate-700">{row.branch}</td>
                    <ReportDataCells counts={row.counts} />
                  </tr>
                )),
                <tr key={`subtotal-${regional.region}`} className="bg-blue-100 font-semibold text-blue-800">
                  <td className="sticky left-28 z-10 border border-blue-200 bg-blue-100 px-3 py-2 text-left tracking-wide">SUB TOTAL</td>
                  <ReportDataCells counts={regional.counts} subtotal />
                </tr>,
              ])}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 font-bold text-white">
                <td colSpan={2} className="sticky left-0 z-10 border border-slate-700 bg-slate-900 px-3 py-2.5 text-left tracking-wide text-white">AREA 2</td>
                <ReportDataCells counts={totals} grandTotal />
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700">Ringkasan</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-800">Progress per branch</h3>
            </div>
            <button
              type="button"
              onClick={copySummary}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <FaCopy aria-hidden="true" />
              {copyFeedback}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-700">
            {textSummary}
          </pre>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700">Rincian order</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-800">Survey Open</h3>
            </div>
            <button
              type="button"
              onClick={copySurveyOpenDetails}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <FaCopy aria-hidden="true" />
              {surveyDetailCopyFeedback}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-700">
            {surveyOpenDetails}
          </pre>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700">Rincian order</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-800">Provisioning Issued</h3>
            </div>
            <button
              type="button"
              onClick={copyProvisioningDetails}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <FaCopy aria-hidden="true" />
              {piDetailCopyFeedback}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-[11px] leading-5 text-slate-700">
            {provisioningDetails}
          </pre>
        </div>
        </div>
      )}
    </section>
  );
}
