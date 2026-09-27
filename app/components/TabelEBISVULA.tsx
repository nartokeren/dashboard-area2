'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { regionalMapping, regionalOrder } from '@/constants';
import { parseDate } from '@/utils/date';

interface VulaOrder {
  DATECREATED?: unknown;
  STATUS?: unknown;
  Branch?: string;
  District?: string;
  DISTRICT_TIF?: string;
  Regional?: string;
  WORKZONE?: string;
  WORKORDER?: string;
}

interface VulaCounts {
  totalOrders: number;
  statusCounts: Record<string, number>;
  age0To3: number;
  age3To7: number;
  age7To14: number;
  age14To30: number;
  ageOver30: number;
}

interface VulaBranchRow {
  name: string;
  counts: VulaCounts;
}

interface VulaRegionalRow {
  name: string;
  counts: VulaCounts;
  branches: VulaBranchRow[];
}

interface TabelEBISVULAProps {
  filteredData: VulaOrder[];
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const preferredStatusOrder = [
  'WAPPR',
  'STARTWORK',
  'CONTWORK',
  'WORKFAIL',
  'INSTCOMP',
  'ACTCOMP',
  'VALSTART',
  'VALCOMP',
];
const groupedStatusColumns = new Set([
  'WAPPR',
  'STARTWORK',
  'CONTWORK',
  'WORKFAIL',
  'INSTCOMP',
  'ACTCOMP',
  'VALSTART',
  'VALCOMP',
]);

const getStatusValue = (value: unknown) => String(value ?? '').trim().toUpperCase() || 'TANPA STATUS';

const createEmptyCounts = (statuses: string[]): VulaCounts => ({
  totalOrders: 0,
  statusCounts: Object.fromEntries(statuses.map((status) => [status, 0])),
  age0To3: 0,
  age3To7: 0,
  age7To14: 0,
  age14To30: 0,
  ageOver30: 0,
});

const addCounts = (target: VulaCounts, source: VulaCounts, statuses: string[]) => {
  target.totalOrders += source.totalOrders;
  target.age0To3 += source.age0To3;
  target.age3To7 += source.age3To7;
  target.age7To14 += source.age7To14;
  target.age14To30 += source.age14To30;
  target.ageOver30 += source.ageOver30;
  statuses.forEach((status) => {
    target.statusCounts[status] += source.statusCounts[status] || 0;
  });
};

const getOrderCounts = (orders: VulaOrder[], statuses: string[], now: Date): VulaCounts => {
  const counts = createEmptyCounts(statuses);

  orders.forEach((order) => {
    counts.totalOrders += 1;
    counts.statusCounts[getStatusValue(order.STATUS)] += 1;

    const createdAt = parseDate(order.DATECREATED);
    if (!createdAt) return;

    const ageInDays = Math.max(0, (now.getTime() - createdAt.getTime()) / 86_400_000);
    if (ageInDays < 3) counts.age0To3 += 1;
    else if (ageInDays < 7) counts.age3To7 += 1;
    else if (ageInDays < 14) counts.age7To14 += 1;
    else if (ageInDays <= 30) counts.age14To30 += 1;
    else counts.ageOver30 += 1;
  });

  return counts;
};

const sortByRegionalOrder = (first: VulaRegionalRow, second: VulaRegionalRow) => {
  const firstIndex = regionalOrder.indexOf(first.name);
  const secondIndex = regionalOrder.indexOf(second.name);
  return (firstIndex < 0 ? regionalOrder.length : firstIndex) -
    (secondIndex < 0 ? regionalOrder.length : secondIndex) ||
    first.name.localeCompare(second.name);
};

export default function TabelEBISVULA({ filteredData, handleFileUpload }: TabelEBISVULAProps) {
  const [copyFeedback, setCopyFeedback] = useState('Salin summary');
  const now = useMemo(() => new Date(), []);
  const tableExportId = 'ebis-vula-report-table';
  const statusColumns = useMemo(() => {
    const statuses = Array.from(new Set(filteredData.map((order) => getStatusValue(order.STATUS))));
    return statuses.sort((first, second) => {
      const firstIndex = preferredStatusOrder.indexOf(first);
      const secondIndex = preferredStatusOrder.indexOf(second);
      return (firstIndex < 0 ? preferredStatusOrder.length : firstIndex) -
        (secondIndex < 0 ? preferredStatusOrder.length : secondIndex) ||
        first.localeCompare(second);
    });
  }, [filteredData]);
  const otherStatusColumns = statusColumns.filter((status) => !groupedStatusColumns.has(status));
  const detailProgressColumnCount = 10 + otherStatusColumns.length;

  const report = useMemo(() => {
    const grouped = new Map<string, Map<string, VulaOrder[]>>();

    filteredData.forEach((order) => {
      const branch = String(order.Branch || order.District || order.DISTRICT_TIF || 'UNKNOWN')
        .trim()
        .toUpperCase();
      const regional = regionalMapping[branch] || String(order.Regional || 'LAINNYA').trim().toUpperCase();

      if (!grouped.has(regional)) grouped.set(regional, new Map());
      const branchGroups = grouped.get(regional)!;
      if (!branchGroups.has(branch)) branchGroups.set(branch, []);
      branchGroups.get(branch)!.push(order);
    });

    const regionalRows: VulaRegionalRow[] = [];
    const areaCounts = createEmptyCounts(statusColumns);

    grouped.forEach((branchGroups, regional) => {
      const regionalCounts = createEmptyCounts(statusColumns);
      const branches = Array.from(branchGroups.entries())
        .map(([name, orders]) => ({ name, counts: getOrderCounts(orders, statusColumns, now) }))
        .sort((first, second) => first.name.localeCompare(second.name));

      branches.forEach((branch) => addCounts(regionalCounts, branch.counts, statusColumns));
      addCounts(areaCounts, regionalCounts, statusColumns);
      regionalRows.push({ name: regional, counts: regionalCounts, branches });
    });

    return { regionalRows: regionalRows.sort(sortByRegionalOrder), areaCounts };
  }, [filteredData, now, statusColumns]);

  const branchSummaryRows = report.regionalRows
    .flatMap((regional) => regional.branches)
    .sort((first, second) => second.counts.totalOrders - first.counts.totalOrders || first.name.localeCompare(second.name));
  const inProgressTotal = (report.areaCounts.statusCounts.STARTWORK || 0) +
    (report.areaCounts.statusCounts.CONTWORK || 0) +
    (report.areaCounts.statusCounts.WORKFAIL || 0);
  const activationTotal = (report.areaCounts.statusCounts.ACTCOMP || 0) +
    (report.areaCounts.statusCounts.VALSTART || 0) +
    (report.areaCounts.statusCounts.VALCOMP || 0);
  const updateTimestamp = format(new Date(), 'dd-MMMM-yyyy  HH:mm');
  const progressSummary = [
    '📊 MONITORING PSB SALDO OPEN VULA',
    `📅 UPDATE DATA : ${updateTimestamp}`,
    'SOURCE : https://10.2.113.250/flow/',
    '',
    `- INPROGRESS TA : ${inProgressTotal}`,
    `- ACTIVATION ORDER : ${activationTotal}`,
    `- TASK NON TA (WAPPR) : ${report.areaCounts.statusCounts.WAPPR || 0}`,
    '================================',
    '*BRANCH TA* | *SALDO HI*',
    ...branchSummaryRows.map((branch) => `${branch.name} | *${branch.counts.totalOrders}*`),
    `AREA 2 | *${report.areaCounts.totalOrders}*`,
  ].join('\n');
  const activationStatuses = new Set(['INSTCOMP', 'ACTCOMP', 'VALSTART', 'VALCOMP']);
  const activationOrders = filteredData
    .filter((order) => activationStatuses.has(String(order.STATUS ?? '').trim().toUpperCase()))
    .sort((first, second) => {
      const firstBranch = String(first.Branch || first.District || first.DISTRICT_TIF || '').toUpperCase();
      const secondBranch = String(second.Branch || second.District || second.DISTRICT_TIF || '').toUpperCase();
      return firstBranch.localeCompare(secondBranch) ||
        String(first.WORKZONE || '').localeCompare(String(second.WORKZONE || ''));
    });
  const detailSummary = [
    '*DETAIL ORDER VULA SEGERA PUSH COMPLETED (PS)*',
    '',
    'BRANCH TA | WORKZONE | WORKORDER | STATUS',
    '',
    ...activationOrders.map((order) => {
      const branch = String(order.Branch || order.District || order.DISTRICT_TIF || 'UNKNOWN').trim().toUpperCase();
      const workzone = String(order.WORKZONE || '-').trim().toUpperCase();
      const workorder = String(order.WORKORDER || '-').trim();
      const status = String(order.STATUS || '-').trim().toUpperCase();
      return `${branch} | ${workzone} | ${workorder} | ${status}`;
    }),
  ].join('\n');

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Tersalin');
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
      link.download = `Report_Progress_Order_VULA_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error export VULA PNG:', error);
      alert('Gagal mengexport tabel VULA. Coba lagi.');
    }
  };

  const uploadControl = (
    <label className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700">
      Upload Excel
      <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} className="hidden" />
    </label>
  );

  if (filteredData.length === 0) {
    return (
      <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-[0_12px_35px_rgba(23,38,61,0.06)]">
        <div className="mb-3 flex justify-end">{uploadControl}</div>
        <p className="text-sm font-medium text-slate-600">Upload file Excel untuk menampilkan report VULA.</p>
        <p className="mt-1 text-xs text-slate-400">Detail progress mengikuti nilai STATUS pada file, usia order dihitung dari DATE CREATED.</p>
      </section>
    );
  }

  const renderCountCells = (counts: VulaCounts, isFooter = false) => (
    <>
      <td className={`border px-2 py-1 text-center font-bold ${isFooter ? 'border-slate-600 bg-cyan-700 text-white' : 'border-slate-200 bg-cyan-50 text-cyan-800'}`}>
        {counts.totalOrders}
      </td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>{counts.statusCounts.WAPPR || 0}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>{counts.statusCounts.STARTWORK || 0}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>{counts.statusCounts.CONTWORK || 0}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>{counts.statusCounts.WORKFAIL || 0}</td>
      <td className={`border px-2 py-1 text-center font-semibold ${isFooter ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
        {(counts.statusCounts.STARTWORK || 0) + (counts.statusCounts.CONTWORK || 0) + (counts.statusCounts.WORKFAIL || 0)}
      </td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>{counts.statusCounts.INSTCOMP || 0}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>{counts.statusCounts.ACTCOMP || 0}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>{counts.statusCounts.VALSTART || 0}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>{counts.statusCounts.VALCOMP || 0}</td>
      <td className={`border px-2 py-1 text-center font-semibold ${isFooter ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
        {(counts.statusCounts.ACTCOMP || 0) + (counts.statusCounts.VALSTART || 0) + (counts.statusCounts.VALCOMP || 0)}
      </td>
      {otherStatusColumns.map((status) => (
        <td key={status} className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 text-slate-700'}`}>
          {counts.statusCounts[status] || 0}
        </td>
      ))}
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-emerald-900 text-white' : 'border-slate-200 bg-emerald-50 text-emerald-900'}`}>{counts.age0To3}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-lime-900 text-white' : 'border-slate-200 bg-lime-50 text-lime-900'}`}>{counts.age3To7}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-amber-900 text-white' : 'border-slate-200 bg-amber-50 text-amber-900'}`}>{counts.age7To14}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-orange-900 text-white' : 'border-slate-200 bg-orange-50 text-orange-900'}`}>{counts.age14To30}</td>
      <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-rose-900 text-white' : 'border-slate-200 bg-rose-50 text-rose-900'}`}>{counts.ageOver30}</td>
    </>
  );

  return (
    <section className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_35px_rgba(23,38,61,0.06)] md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportTableToPNG}
            className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700"
          >
            Export PNG
          </button>
          {uploadControl}
        </div>
      </div>
      <div id={tableExportId} className="bg-white p-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600">Daily report / EBIS</p>
        <h2 className="mb-3 mt-1 text-base font-bold tracking-tight text-slate-800">VULA · Order Progress</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-[1320px] w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th rowSpan={3} className="border border-slate-600 bg-slate-50 px-2 py-2 text-left font-bold text-slate-700">REGIONAL</th>
              <th rowSpan={3} className="border border-slate-600 bg-slate-50 px-2 py-2 text-left font-bold text-slate-700">BRANCH</th>
              <th rowSpan={3} className="border border-cyan-700 bg-cyan-700 px-2 py-2 text-center font-bold">TOTAL ORDER HI</th>
              <th colSpan={detailProgressColumnCount} className="border border-slate-600 px-2 py-2 text-center font-bold">DETAIL PROGRESS</th>
              <th colSpan={5} className="border border-slate-600 px-2 py-2 text-center font-bold">USIA ORDER HI</th>
            </tr>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">TASK NON TA</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5" colSpan={3}>INPROGRESS TA</th>
              <th className="border border-slate-300 bg-cyan-50 px-2 py-1.5 text-cyan-900" rowSpan={2}>TOTAL INPROGRESS</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5" colSpan={4}>ACTIVATION ORDER</th>
              <th className="border border-slate-300 bg-cyan-50 px-2 py-1.5 text-cyan-900" rowSpan={2}>TOTAL ACTIVATION</th>
              {otherStatusColumns.length > 0 && (
                <th className="border border-slate-300 bg-slate-100 px-2 py-1.5" colSpan={otherStatusColumns.length}>OTHER STATUS</th>
              )}
              <th className="border border-slate-300 bg-emerald-100 px-2 py-1.5" rowSpan={2}>0-3 HARI</th>
              <th className="border border-slate-300 bg-lime-100 px-2 py-1.5" rowSpan={2}>3-7 HARI</th>
              <th className="border border-slate-300 bg-amber-100 px-2 py-1.5" rowSpan={2}>7-14 HARI</th>
              <th className="border border-slate-300 bg-orange-100 px-2 py-1.5" rowSpan={2}>14-30 HARI</th>
              <th className="border border-slate-300 bg-rose-100 px-2 py-1.5" rowSpan={2}>&gt;30 HARI</th>
            </tr>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">WAPPR</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">STARTWORK</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">CONTWORK</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">WORKFAIL</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">INSTCOMP</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">ACTCOMP</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">VALSTART</th>
              <th className="border border-slate-300 bg-slate-100 px-2 py-1.5">VALCOMP</th>
              {otherStatusColumns.map((status) => (
                <th key={status} className="border border-slate-300 bg-slate-100 px-2 py-1.5">{status}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.regionalRows.flatMap((regional) => [
              <tr key={`regional-${regional.name}`} className="bg-amber-50 font-bold text-slate-800">
                <td className="border border-slate-200 px-2 py-1.5">{regional.name}</td>
                <td className="border border-slate-200 px-2 py-1.5" />
                {renderCountCells(regional.counts)}
              </tr>,
              ...regional.branches.map((branch) => (
                <tr key={`${regional.name}-${branch.name}`} className="bg-white text-slate-600 hover:bg-cyan-50/50">
                  <td className="border border-slate-200 px-2 py-1.5" />
                  <td className="border border-slate-200 px-2 py-1.5 font-medium">{branch.name}</td>
                  {renderCountCells(branch.counts)}
                </tr>
              )),
            ])}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 font-bold text-white">
              <td colSpan={2} className="border border-slate-600 px-2 py-2">AREA 2</td>
              {renderCountCells(report.areaCounts, true)}
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Detail progress berdasarkan kolom STATUS. Usia order dihitung dari DATE CREATED dengan rentang elapsed yang tidak tumpang tindih.</p>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">Text Summary</h3>
          <button
            type="button"
            onClick={() => copyText(progressSummary)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            {copyFeedback}
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{progressSummary}</pre>
      </div>
      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">Detail Order Activation</h3>
          <button
            type="button"
            onClick={() => copyText(detailSummary)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            Salin detail
          </button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{detailSummary}</pre>
      </div>
    </section>
  );
}