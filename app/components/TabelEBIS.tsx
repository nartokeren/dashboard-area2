'use client';

import { useMemo, useState } from 'react';
import { regionalMapping } from '@/constants';

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
  const regional = sourceRegional || mappedRegional || 'LAINNYA';

  if (regional === 'BANTEN' || regional === 'JAKARTA' || regional === 'JAKARTA & BANTEN') {
    return 'JAKARTA & BANTEN';
  }
  if (regional === 'JAWA BARAT' || regional === 'JABAR') return 'JABAR';
  return regional;
};

const sortByRegionalOrder = (a: EbisRow, b: EbisRow) => {
  const displayOrder = ['EASTERN JABOTABEK', 'JAKARTA & BANTEN', 'JABAR'];
  const aIndex = displayOrder.indexOf(a.name);
  const bIndex = displayOrder.indexOf(b.name);
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? displayOrder.length : aIndex) - (bIndex === -1 ? displayOrder.length : bIndex);
  }
  return a.name.localeCompare(b.name);
};

export default function TabelEBIS({ filteredData, title, handleFileUpload }: TabelEBISProps) {
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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
        districtRows.push({ name: district, level: 'district', counts: districtCounts, children: hsaRows });
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
        width: tableSection.scrollWidth,
        height: tableSection.scrollHeight,
        style: {
          transform: 'scale(1)',
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

  const toggleRow = (row: EbisRow) => {
    const rowKey = `${row.level}-${row.name}`;
    const target = row.level === 'regional' ? collapsedRows : expandedRows;
    const setTarget = row.level === 'regional' ? setCollapsedRows : setExpandedRows;
    const next = new Set(target);

    if (next.has(rowKey)) next.delete(rowKey);
    else next.add(rowKey);
    setTarget(next);
  };

  const getRowTextClass = (level: EbisRow['level']) => {
    if (level === 'regional') return 'font-semibold text-slate-800';
    if (level === 'district') return 'font-medium text-slate-600';
    if (level === 'hsa') return 'text-violet-600';
    return 'text-slate-500';
  };

  const isRowExpanded = (row: EbisRow) => {
    const rowKey = `${row.level}-${row.name}`;
    return row.level === 'regional' ? !collapsedRows.has(rowKey) : expandedRows.has(rowKey);
  };

  const renderRow = (row: EbisRow, depth: number): React.ReactNode[] => [
    <tr key={`${row.level}-${row.name}`} className={row.level === 'regional' ? 'bg-amber-50' : 'bg-white'}>
      <td className={`border border-slate-200 px-2 py-1 text-left ${getRowTextClass(row.level)}`}>
        <span style={{ paddingLeft: `${depth * 18}px` }}>
          {row.children?.length ? (
            <button
              type="button"
              onClick={() => toggleRow(row)}
              className="mr-1 inline-flex h-4 w-4 items-center justify-center font-bold text-violet-600 hover:text-violet-800"
              aria-label={`${isRowExpanded(row) ? 'Collapse' : 'Expand'} ${row.name}`}
            >
              {isRowExpanded(row) ? '−' : '+'}
            </button>
          ) : (
            <span className="mr-1 inline-block w-4" />
          )}
          {row.name}
        </span>
      </td>
      {renderCounts(row.counts, row.level === 'regional' ? 'font-bold text-blue-500' : 'text-blue-500')}
      <td className={`border border-slate-200 px-2 py-1 text-center ${row.level === 'regional' ? 'font-bold' : ''} text-blue-500`}>{getTotal(row.counts)}</td>
    </tr>,
    ...(isRowExpanded(row)
      ? (row.children?.flatMap((child) => renderRow(child, depth + 1)) || [])
      : []),
  ];

  const uploadControl = (
    <label className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700">
      Upload Excel
      <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} className="hidden" />
    </label>
  );

  if (filteredData.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-[0_12px_35px_rgba(23,38,61,0.06)]">
        <div className="mb-3 flex justify-end">{uploadControl}</div>
        <p className="text-sm font-medium text-slate-600">Upload file Excel untuk menampilkan report EBIS {title}.</p>
        <p className="mt-1 text-xs text-slate-400">Tabel, summary, dan export PNG akan tampil setelah data tersedia.</p>
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
            className="rounded-lg bg-[#6d5bd0] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#5b4ab8]"
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
          <table className="min-w-[760px] w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-white">
              <th className="border border-slate-200 bg-slate-50 px-2 py-2 text-left font-semibold text-slate-700">AREA / REG / DISTRICT / HSA / STO</th>
              <th className="border border-slate-200 bg-sky-500 px-2 py-2">TSQ</th>
              <th className="border border-slate-200 bg-emerald-400 px-2 py-2">&lt;1 Hari</th>
              <th className="border border-slate-200 bg-amber-400 px-2 py-2">1-2 Hari</th>
              <th className="border border-slate-200 bg-amber-500 px-2 py-2">2-3 Hari</th>
              <th className="border border-slate-200 bg-red-500 px-2 py-2">&gt;3 Hari</th>
              <th className="border border-slate-200 bg-slate-700 px-2 py-2">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {rows.regionalRows.flatMap((row) => renderRow(row, 1))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 font-bold text-white">
              <td className="border border-slate-700 px-2 py-2 text-left">AREA 2</td>
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
            className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
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
            className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Salin detail
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{detailSummary}</pre>
      </div>
    </section>
  );
}