'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { regionalMapping, regionalOrder } from '@/constants';
import { parseDate } from '@/utils/date';

interface OloCounts {
  totalOrders: number;
  survey: number;
  progressWfm: number;
  e2e: number;
  age0To7: number;
  age7To14: number;
  age14To20: number;
  ageOver20: number;
}

interface OloBranchRow {
  name: string;
  counts: OloCounts;
}

interface OloRegionalRow {
  name: string;
  counts: OloCounts;
  branches: OloBranchRow[];
}

interface TabelEBISOLOProps {
  filteredData: OloOrder[];
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface OloOrder {
  DATECREATED?: unknown;
  Description?: unknown;
  Branch?: string;
  District?: string;
  DISTRICT_TIF?: string;
  Regional?: string;
  WORKZONE?: string;
  SCOrderId?: string;
}

const isE2EDescription = (description: unknown) => {
  const value = String(description ?? '').toUpperCase();
  if (value.includes('SURVEY')) return false;

  return value.includes('E2E') ||
    value.includes('CE JUMPERING') ||
    value.includes('SERVICE TESTING') ||
    value.includes('REGISTRATION SUPLYCHAIN') ||
    value.includes('REGISTRATION SUPPLYCHAIN') ||
    value.includes('REGISTRATION SUPPLY CHAIN');
};

const createEmptyCounts = (): OloCounts => ({
  totalOrders: 0,
  survey: 0,
  progressWfm: 0,
  e2e: 0,
  age0To7: 0,
  age7To14: 0,
  age14To20: 0,
  ageOver20: 0,
});

const addCounts = (target: OloCounts, source: OloCounts) => {
  (Object.keys(target) as (keyof OloCounts)[]).forEach((key) => {
    target[key] += source[key];
  });
};

const getOrderCounts = (orders: OloOrder[], now: Date): OloCounts => {
  const counts = createEmptyCounts();

  orders.forEach((order) => {
    counts.totalOrders += 1;
    const description = String(order.Description ?? '').toUpperCase();
    if (description.includes('SURVEY')) {
      counts.survey += 1;
    } else if (isE2EDescription(description)) {
      counts.e2e += 1;
    } else {
      counts.progressWfm += 1;
    }

    const createdAt = parseDate(order.DATECREATED);
    if (!createdAt) return;

    const ageInDays = Math.max(0, (now.getTime() - createdAt.getTime()) / 86_400_000);
    if (ageInDays < 7) counts.age0To7 += 1;
    else if (ageInDays < 14) counts.age7To14 += 1;
    else if (ageInDays <= 20) counts.age14To20 += 1;
    else counts.ageOver20 += 1;
  });

  return counts;
};

const sortByRegionalOrder = (first: OloRegionalRow, second: OloRegionalRow) => {
  const firstIndex = regionalOrder.indexOf(first.name);
  const secondIndex = regionalOrder.indexOf(second.name);
  return (firstIndex < 0 ? regionalOrder.length : firstIndex) -
    (secondIndex < 0 ? regionalOrder.length : secondIndex) ||
    first.name.localeCompare(second.name);
};

export default function TabelEBISOLO({ filteredData, handleFileUpload }: TabelEBISOLOProps) {
  const [copyFeedback, setCopyFeedback] = useState('Salin summary');
  const now = useMemo(() => new Date(), []);
  const tableExportId = 'ebis-olo-report-table';

  const report = useMemo(() => {
    const grouped = new Map<string, Map<string, OloOrder[]>>();

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

    const regionalRows: OloRegionalRow[] = [];
    const areaCounts = createEmptyCounts();

    grouped.forEach((branchGroups, regional) => {
      const regionalCounts = createEmptyCounts();
      const branches = Array.from(branchGroups.entries())
        .map(([name, orders]) => ({ name, counts: getOrderCounts(orders, now) }))
        .sort((first, second) => first.name.localeCompare(second.name));

      branches.forEach((branch) => addCounts(regionalCounts, branch.counts));
      addCounts(areaCounts, regionalCounts);
      regionalRows.push({ name: regional, counts: regionalCounts, branches });
    });

    return { regionalRows: regionalRows.sort(sortByRegionalOrder), areaCounts };
  }, [filteredData, now]);

  const branchSurveyRows = report.regionalRows
    .flatMap((regional) => regional.branches)
    .sort((first, second) => second.counts.survey - first.counts.survey || first.name.localeCompare(second.name));
  const e2eOrders = filteredData
    .filter((order) => isE2EDescription(order.Description))
    .sort((first, second) => {
      const firstBranch = String(first.Branch || first.District || first.DISTRICT_TIF || '').toUpperCase();
      const secondBranch = String(second.Branch || second.District || second.DISTRICT_TIF || '').toUpperCase();
      return firstBranch.localeCompare(secondBranch) ||
        String(first.WORKZONE || '').localeCompare(String(second.WORKZONE || ''));
    });
  const updateTimestamp = format(new Date(), 'dd-MMMM-yyyy HH:mm');
  const progressSummary = [
    'ORDER SURVEY OLO – Monitoring Berkala',
    `Update Data : ${updateTimestamp}`,
    'Source : https://10.2.113.250/flow/',
    '',
    `Order Survey HI : ${report.areaCounts.survey}`,
    '================================',
    '*BRANCH TA* | *HI*',
    ...branchSurveyRows.map((branch) => `${branch.name} | ${branch.counts.survey}`),
    `AREA 2 | ${report.areaCounts.survey}`,
  ].join('\n');
  const detailSummary = [
    '*DETAIL ORDER OLO SEGERA CLOSED LENSA*',
    '',
    'BRANCH TA | WORKZONE | ORDER ID | TASK',
    '',
    ...e2eOrders.map((order) => {
      const branch = String(order.Branch || order.District || order.DISTRICT_TIF || 'UNKNOWN').trim().toUpperCase();
      const workzone = String(order.WORKZONE || '-').trim().toUpperCase();
      const orderId = String(order.SCOrderId || '').split('_')[0] || '-';
      const task = String(order.Description || '-').replace(/\s+/g, ' ').trim();
      return `${branch} | ${workzone} | ${orderId} | ${task}`;
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
      link.download = `Report_Progress_Order_OLO_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error export OLO PNG:', error);
      alert('Gagal mengexport tabel OLO. Coba lagi.');
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
        <p className="text-sm font-medium text-slate-600">Upload file Excel untuk menampilkan report OLO.</p>
        <p className="mt-1 text-xs text-slate-400">Report OLO akan membaca tanggal order dan deskripsi aktivitas dari file.</p>
      </section>
    );
  }

  const renderCountCells = (counts: OloCounts, isFooter = false) => {
    return (
      <>
        <td className={`border px-2 py-1 text-center font-bold ${isFooter ? 'border-slate-600 bg-cyan-700 text-white' : 'border-slate-200 bg-cyan-50 text-cyan-800'}`}>{counts.totalOrders}</td>
        <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200'}`}>{counts.survey}</td>
        <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200'}`}>{counts.progressWfm}</td>
        <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200'}`}>{counts.e2e}</td>
        <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-emerald-900 text-white' : 'border-slate-200 bg-emerald-50'}`}>{counts.age0To7}</td>
        <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-amber-900 text-white' : 'border-slate-200 bg-amber-50'}`}>{counts.age7To14}</td>
        <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-orange-900 text-white' : 'border-slate-200 bg-orange-50'}`}>{counts.age14To20}</td>
        <td className={`border px-2 py-1 text-center ${isFooter ? 'border-slate-600 bg-rose-900 text-white' : 'border-slate-200 bg-rose-50'}`}>{counts.ageOver20}</td>
      </>
    );
  };

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
        <h2 className="mb-3 mt-1 text-base font-bold tracking-tight text-slate-800">OLO · Order Progress</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-[1120px] w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th rowSpan={2} className="border border-slate-600 bg-slate-50 px-2 py-2 text-left font-bold text-slate-700">REGIONAL</th>
              <th rowSpan={2} className="border border-slate-600 bg-slate-50 px-2 py-2 text-left font-bold text-slate-700">BRANCH</th>
              <th rowSpan={2} className="border border-cyan-700 bg-cyan-700 px-2 py-2 text-center font-bold">TOTAL ORDER HI</th>
              <th colSpan={3} className="border border-slate-600 px-2 py-2 text-center font-bold">DETAIL PROGRESS</th>
              <th colSpan={4} className="border border-slate-600 px-2 py-2 text-center font-bold">USIA ORDER HI</th>
            </tr>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 px-2 py-1.5">SURVEY</th>
              <th className="border border-slate-300 px-2 py-1.5">PROGRESS WFM</th>
              <th className="border border-slate-300 px-2 py-1.5">E2E</th>
              <th className="border border-slate-300 bg-emerald-100 px-2 py-1.5">0-7 Hari</th>
              <th className="border border-slate-300 bg-amber-100 px-2 py-1.5">7-14 Hari</th>
              <th className="border border-slate-300 bg-orange-100 px-2 py-1.5">14-20 Hari</th>
              <th className="border border-slate-300 bg-rose-100 px-2 py-1.5">&gt;20 Hari</th>
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
      <p className="mt-2 text-[10px] text-slate-400">Total order dihitung dari seluruh data pada file. Usia order dihitung dari DATE CREATED dengan rentang elapsed yang tidak tumpang tindih.</p>
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
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">Detail Order E2E</h3>
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