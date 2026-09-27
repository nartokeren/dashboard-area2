'use client';

import { useRouter } from 'next/navigation';
import { FaBars } from 'react-icons/fa';
import Image from 'next/image'; // Panggil komponen Image dari Next.js

export default function Home() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 py-12">
      <div className="w-full max-w-4xl text-center">
        <div className="mb-8 flex items-center justify-center gap-7 md:gap-10">
          <div className="relative h-20 w-20 md:h-24 md:w-24">
            <Image
              src="/png TA.png" // Ganti dengan nama file logo kamu
              alt="Logo Perusahaan"
              fill
              className="object-contain"
            />
          </div>

          <div className="relative h-20 w-20 md:h-24 md:w-24">
            <Image
              src="/png telkom.png" // Ganti dengan nama file logo Telkom
              alt="Logo Telkom Indonesia"
              fill
              className="object-contain"
            />
          </div>

          <div className="relative h-20 w-20 md:h-24 md:w-24">
            <Image
              src="/png danantara.png" // Ganti dengan nama file logo Andantara
              alt="Logo Andantara"
              fill
              className="object-contain"
            />
          </div>
        </div>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-700">Operations Control Room</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Telkom Akses
        </h1>
        <p className="text-lg font-medium text-slate-700">Monitoring Order <span className="text-cyan-700">AREA 2</span></p>
        <div className="mx-auto my-7 h-px w-20 bg-cyan-600" />
        <p className="mx-auto mb-8 max-w-xl text-sm leading-6 text-slate-600">
          Dashboard terpusat untuk memantau progres, usia, dan performa order harian.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="mx-auto flex items-center gap-2 rounded-lg bg-blue-700 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-offset-4"
        >
          <FaBars size={18} />
          Buka Dashboard
        </button>

        <div className="mt-14 text-xs text-slate-500">
          Rudi Narto Lutfianto • Developer
        </div>
      </div>
    </main>
  );
}