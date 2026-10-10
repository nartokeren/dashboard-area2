'use client';

import { useMemo, useState } from 'react';
import { regionalMapping, regionalOrder } from '@/constants';

type Bucket = 'tsq' | 'lessThanOne' | 'oneToTwo' | 'twoToThree' | 'moreThanThree';

interface Counts {
  tsq: number;
  lessThanOne: number;
  oneToTwo: number;
  twoToThree: number;
  moreThanThree: number;
}

interface EbisRow {
  name: string;
  level: 'area' | 'regional' | 'district' | 'hsa' | 'sto';
  counts: Counts;
  children?: EbisRow[];
}

interface TabelEBISProps {
  filteredData: any[];
  title: 'DATIN' | 'WIFI';
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const emptyCounts = (): Counts => ({
  tsq: 0,
  lessThanOne: 0,
  oneToTwo: 0,
  twoToThree: 0,
  moreThanThree: 0,
});

const addCounts = (target: Counts, source: Counts) => {
  target.tsq += source.tsq;
  target.lessThanOne += source.lessThanOne;
  target.oneToTwo += source.oneToTwo;
  target.twoToThree += source.twoToThree;
  target.moreThanThree += source.moreThanThree;
};

const getTotal = (counts: Counts) => (
  counts.tsq +
  counts.lessThanOne +
  counts.oneToTwo +
  counts.twoToThree +
  counts.moreThanThree
);

const parseDurationHours = (value: unknown): number | null => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return null;

  const dayMatch = text.match(/(\d+(?:[.,]\d+)?)\s*hari/);
  const hourMatch = text.match(/(\d+(?:[.,]\d+)?)\s*jam/);
  const days = dayMatch ? Number(dayMatch[1].replace(',', '.')) : 0;
  const hours = hourMatch ? Number(hourMatch[1].replace(',', '.')) : 0;
  const totalHours = days * 24 + hours;

  return Number.isFinite(totalHours) ? totalHours : null;
};

const getBucket = (duration: unknown): Bucket | null => {
  const ageHours = parseDurationHours(duration);
  if (ageHours === null) return null;
  if (ageHours < 24) return 'lessThanOne';
  if (ageHours < 48) return 'oneToTwo';
  if (ageHours < 72) return 'twoToThree';
  return 'moreThanThree';
};

const isTsqRow = (row: any, title: 'DATIN' | 'WIFI') => {
  const description = String(row.Description ?? '');
  return title === 'WIFI' ? /Review Order/i.test(description) : /TSQ/i.test(description);
};

const isCriticalRow = (row: any, title: 'DATIN' | 'WIFI') => {
  if (isTsqRow(row, title)) return false;

  const remaining = String(row.Sisa ?? '').toLowerCase();
  return remaining.includes('🟡') || remaining.includes('🔴');
};

const getRowCounts = (rows: any[], title: 'DATIN' | 'WIFI'): Counts => {
  const counts = emptyCounts();

  rows.forEach((row) => {
    if (isTsqRow(row, title)) {
      counts.tsq += 1;
      return;
    }

    const bucket = getBucket(row.TTDC);
    if (bucket) counts[bucket] += 1;
  });

  return counts;
};

const normalizeRegional = (value: unknown, district: string) => {
  const sourceRegional = String(value ?? '').trim().toUpperCase();
  const mappedRegional = regionalMapping[district];
  return mappedRegional || sourceRegional || 'LAINNYA';
};

const sortByRegionalOrder = (a: EbisRow, b: EbisRow) => {
  const aIndex = regionalOrder.indexOf(a.name);
  const bIndex = regionalOrder.indexOf(b.name);
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? regionalOrder.length : aIndex) - (bIndex === -1 ? regionalOrder.length : bIndex);
  }
  return a.name.localeCompare(b.name);
};

export default function TabelEBIS({ filteredData, title, handleFileUpload }: TabelEBISProps) {
  const [copyFeedback, setCopyFeedback] = useState('Salin summary');
  const tableExportId = `ebis-table-${title.toLowerCase()}`;

  const rows = useMemo(() => {
    const regionalGroups = new Map<string, Map<string, Map<string, Map<string, any[]>>>>();

    filteredData.forEach((row) => {
      const district = String(row.District || row.DISTRICT_TIF || 'UNKNOWN').trim().toUpperCase();
      const regional = normalizeRegional(row.Regional, district);
      const hsa = String(row.HSA || 'UNKNOWN').trim().toUpperCase();
      const sto = String(row.WORKZONE || row.STO || 'UNKNOWN').trim().toUpperCase();

      if (!regionalGroups.has(regional)) regionalGroups.set(regional, new Map());
      const districtGroups = regionalGroups.get(regional)!;
      if (!districtGroups.has(district)) districtGroups.set(district, new Map());
      const hsaGroups = districtGroups.get(district)!;
      if (!hsaGroups.has(hsa)) hsaGroups.set(hsa, new Map());
      const stoGroups = hsaGroups.get(hsa)!;
      if (!stoGroups.has(sto)) stoGroups.set(sto, []);
      stoGroups.get(sto)!.push(row);
    });

    const regionalRows: EbisRow[] = [];
    regionalGroups.forEach((districtGroups, regional) => {
      const districtRows: EbisRow[] = [];
      districtGroups.forEach((hsaGroups, district) => {
        const hsaRows: EbisRow[] = [];
        hsaGroups.forEach((stoGroups, hsa) => {
        const stoRows: EbisRow[] = Array.from(stoGroups.entries()).map(([sto, data]) => ({
          name: sto,
          level: 'sto',
          counts: getRowCounts(data, title),
        }));
          const hsaCounts = emptyCounts();
          stoRows.forEach((row) => addCounts(hsaCounts, row.counts));
          hsaRows.push({ name: hsa, level: 'hsa', counts: hsaCounts, children: stoRows });
        });
        const districtCounts = emptyCounts();
        hsaRows.forEach((row) => addCounts(districtCounts, row.counts));
        districtRows.push({ name: district, level: 'district', counts: districtCounts });
      });

      const regionalCounts = emptyCounts();
      districtRows.forEach((row) => addCounts(regionalCounts, row.counts));
      regionalRows.push({
        name: regional,
        level: 'regional',
        counts: regionalCounts,
        children: districtRows.sort((a, b) => a.name.localeCompare(b.name)),
      });
    });

    const areaCounts = emptyCounts();
    regionalRows.forEach((row) => addCounts(areaCounts, row.counts));

    return {
      area: { name: 'AREA 2', level: 'area' as const, counts: areaCounts },
      regionalRows: regionalRows.sort(sortByRegionalOrder),
    };
  }, [filteredData, title]);

  const renderCounts = (counts: Counts, textClass = 'text-blue-500') => (
    <>
      <td className={`border border-slate-200 px-2 py-1 text-center ${textClass}`}>{counts.tsq}</td>
      <td className={`border border-slate-200 px-2 py-1 text-center ${textClass}`}>{counts.lessThanOne}</td>
      <td className={`border border-slate-200 px-2 py-1 text-center ${textClass}`}>{counts.oneToTwo}</td>
      <td className={`border border-slate-200 px-2 py-1 text-center ${textClass}`}>{counts.twoToThree}</td>
      <td className={`border border-slate-200 px-2 py-1 text-center ${textClass}`}>{counts.moreThanThree}</td>
    </>
  );

  const formatSummaryCounts = (counts: Counts) => [
    counts.tsq,
    counts.lessThanOne,
    counts.oneToTwo,
    counts.twoToThree,
    counts.moreThanThree,
    getTotal(counts),
  ].join(' | ');

  const progressSummary = useMemo(() => {
    const branchRows = rows.regionalRows
      .flatMap((regionalRow) => regionalRow.children || [])
      .sort((first, second) => getTotal(second.counts) - getTotal(first.counts));
    const source = title === 'DATIN'
      ? 'http://10.2.113.234:8070/ttdc/datin-area-all'
      : 'http://10.2.113.234:8070/ttdc/wifi-area-all?#';
    const lines = [
      `REPORT PROGRESS ORDER ${title}  AREA 2`,
      '',
      'BRANCH | TSQ | <1 Hari | 1-2 Hari | 2-3 Hari | >3 Hari | TOTAL',
      ...branchRows.map((branchRow) => `${branchRow.name.replace(/\s+/g, '')} | ${formatSummaryCounts(branchRow.counts)}`),
      `AREA 2 | ${formatSummaryCounts(rows.area.counts)}`,
      '',
      `sources: ${source}`,
    ];
    return lines.join('\n');
  }, [rows, title]);

  const detailSummary = useMemo(() => {
    const criticalRows = filteredData
      .filter((row) => isCriticalRow(row, title))
      .sort((first, second) => {
        const firstDistrict = String(first.District || first.DISTRICT_TIF || '').toUpperCase();
        const secondDistrict = String(second.District || second.DISTRICT_TIF || '').toUpperCase();
        const firstWorkzone = String(first.WORKZONE || first.STO || '').toUpperCase();
        const secondWorkzone = String(second.WORKZONE || second.STO || '').toUpperCase();
        return firstDistrict.localeCompare(secondDistrict) || firstWorkzone.localeCompare(secondWorkzone);
      });
    const detailHeader = title === 'DATIN'
      ? 'District | STO | No Order | Task | Sisa TTDC'
      : 'District | STO | SC | Task | Sisa TTDC';
    const detailLines = criticalRows.map((row) => {
      const district = String(row.District || row.DISTRICT_TIF || 'UNKNOWN').trim().toUpperCase();
      const sto = String(row.WORKZONE || row.STO || 'UNKNOWN').trim().toUpperCase();
      const identifier = title === 'DATIN'
        ? String(row.NoOrder || row.WONUM || '-')
        : String(row.SCID || row.NoOrder || row.WONUM || '-');
      const task = String(row.Description || '-').replace(/\s+/g, ' ').trim();
      const remaining = String(row.Sisa || '-').replace(/\s+/g, ' ').trim();
      return `${district} | ${sto} | ${identifier} | ${task} | ${remaining}`;
    });
    const lines = [
      `*DETAIL ORDER ${title} TTDC KRITIS*`,
      '',
      detailHeader,
      '',
      ...detailLines,
    ];
    return lines.join('\n');
  }, [filteredData, title]);

  const copySummary = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Summary tersalin');
      window.setTimeout(() => setCopyFeedback('Salin summary'), 2000);
    } catch {
      setCopyFeedback('Gagal menyalin');
    }
  };

  const exportTableToPNG = async () => {
    const tableSection = document.getElementById(tableExportId);
    if (!tableSection) return;

    try {
      const domtoimage = (await import('dom-to-image')).default;
      const dataUrl = await domtoimage.toPng(tableSection, {
        quality: 1,
        bgcolor: '#ffffff',
        width: tableSection.scrollWidth * 2,
        height: tableSection.scrollHeight * 2,
        style: {
          transform: 'scale(2)',
          transformOrigin: 'top left',
          overflow: 'visible',
          width: `${tableSection.scrollWidth}px`,
          minWidth: `${tableSection.scrollWidth}px`,
        },
      });

      const link = document.createElement('a');
      link.download = `Report_Progress_Order_${title}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error export EBIS PNG:', error);
      alert('Gagal mengexport tabel EBIS. Coba lagi.');
    }
  };

  const getRowTextClass = (level: EbisRow['level']) => {
    if (level === 'regional') return 'font-semibold text-slate-800';
    if (level === 'district') return 'font-medium text-slate-600';
    if (level === 'hsa') return 'text-violet-600';
    return 'text-slate-500';
  };

  const countRows = (row: EbisRow): number => (
    1 + (row.children || []).reduce((total, child) => total + countRows(child), 0)
  );

  const renderDetailRow = (row: EbisRow, regionalCell?: React.ReactNode): React.ReactNode[] => [
    <tr key={`${row.level}-${row.name}`} className="bg-white">
      {regionalCell}
      <td className={`border border-slate-200 px-2 py-1 text-left ${getRowTextClass(row.level)}`}>
        <span style={{ paddingLeft: `${row.level === 'district' ? 0 : row.level === 'hsa' ? 18 : 36}px` }}>
          {row.name}
        </span>
      </td>
      {renderCounts(row.counts, 'text-blue-500')}
      <td className="border border-slate-200 px-2 py-1 text-center text-blue-500">{getTotal(row.counts)}</td>
    </tr>,
    ...(row.children?.flatMap((child) => renderDetailRow(child)) || []),
  ];

  const renderRegionalRows = (regional: EbisRow): React.ReactNode[] => {
    const children = regional.children || [];
    const regionalRowSpan = children.reduce((total, child) => total + countRows(child), 0) + 1;
    const regionalCell = (
      <td
        key={`regional-${regional.name}`}
        rowSpan={regionalRowSpan}
        className="border border-slate-200 bg-blue-50 px-2 py-1 text-left align-middle font-bold text-slate-800"
      >
        {regional.name}
      </td>
    );
    const visibleRows = children.flatMap((child, index) => renderDetailRow(child, index === 0 ? regionalCell : undefined));

    return [
      ...visibleRows,
      <tr key={`subtotal-${regional.name}`} className="bg-blue-100 font-bold text-slate-800">
        <td className="border border-slate-200 px-2 py-1 text-left">SUB TOTAL</td>
        {renderCounts(regional.counts, 'text-blue-700')}
        <td className="border border-slate-200 px-2 py-1 text-center text-blue-700">{getTotal(regional.counts)}</td>
      </tr>,
    ];
  };

  const uploadControl = (
    <label className="report-action report-action--upload">
      Upload Excel
      <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} className="hidden" />
    </label>
  );

  if (filteredData.length === 0) {
    return (
      <section className="mt-4 min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_35px_rgba(23,38,61,0.06)] md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700">Daily report / EBIS</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">{title} · Aging Order</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Upload data untuk membentuk tabel, ringkasan, dan detail report.</p>
          </div>
          {uploadControl}
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">Belum ada data report</p>
          <p className="mt-1 text-xs text-slate-500">Pilih file Excel EBIS {title} untuk mulai.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_35px_rgba(23,38,61,0.06)] md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {uploadControl}
          <button
            type="button"
            onClick={exportTableToPNG}
            className="report-action report-action--export"
          >
            Export PNG
          </button>
        </div>
      </div>
      <div id={tableExportId} className="bg-white px-0.5 pb-0.5 pt-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600">Daily report / EBIS</p>
        <h2 className="mt-1 text-base font-bold tracking-tight text-slate-800">{title} · Aging Order</h2>
        <p className="mb-3 mt-1 text-xs text-slate-500">TSQ dari kolom Description. Aging lainnya dari kolom Durasi TTDC.</p>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[900px] w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-white">
              <th className="w-[18%] border border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-700">REGIONAL</th>
              <th className="w-[22%] border border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-700">BRANCH</th>
              <th className="border border-slate-200 bg-sky-500 px-2 py-2">TSQ</th>
              <th className="border border-slate-200 bg-emerald-400 px-2 py-2">&lt;1 Hari</th>
              <th className="border border-slate-200 bg-amber-400 px-2 py-2">1-2 Hari</th>
              <th className="border border-slate-200 bg-amber-500 px-2 py-2">2-3 Hari</th>
              <th className="border border-slate-200 bg-red-500 px-2 py-2">&gt;3 Hari</th>
              <th className="border border-slate-200 bg-slate-700 px-2 py-2">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.regionalRows.flatMap((row) => renderRegionalRows(row))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 font-bold text-white">
              <td colSpan={2} className="border border-slate-700 px-2 py-2 text-left">AREA 2</td>
              {renderCounts(rows.area.counts, 'text-white')}
              <td className="border border-slate-700 px-2 py-2 text-center text-white">{getTotal(rows.area.counts)}</td>
            </tr>
          </tfoot>
          </table>
        </div>
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">Text Summary</h3>
          <button
            type="button"
            onClick={() => copySummary(progressSummary)}
            className="report-action report-action--copy"
          >
            {copyFeedback}
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{progressSummary}</pre>
      </div>
      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">Detail Order Kritis</h3>
          <button
            type="button"
            onClick={() => copySummary(detailSummary)}
            className="report-action report-action--copy"
          >
            Salin detail
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{detailSummary}</pre>
      </div>
    </section>
  );
}