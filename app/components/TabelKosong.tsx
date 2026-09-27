'use client';

import { FaChartBar } from 'react-icons/fa';

export default function TabelKosong({ title }: { title: string }) {
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
      <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
        <FaChartBar size={20} />
      </span>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700">Report workspace</p>
      <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-800">{title}</h2>
      <p className="text-sm text-slate-600">Report untuk menu ini belum tersedia.</p>
    </section>
  );
}