'use client';

import { useRouter } from 'next/navigation';
import { FaBars } from 'react-icons/fa';
import Image from 'next/image'; // Panggil komponen Image dari Next.js

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">

        {/* --- BAGIAN LOGO (DI TAMBAHKAN DI SINI) --- */}
        <div className="flex justify-center items-center gap-6 mb-6">
          {/* Logo Perusahaanmu */}
          <div className="w-24 h-24 relative">
            <Image
              src="/png TA.png" // Ganti dengan nama file logo kamu
              alt="Logo Perusahaan"
              fill
              className="object-contain"
            />
          </div>

          {/* Logo Telkom Indonesia */}
          <div className="w-24 h-24 relative">
            <Image
              src="/png telkom.png" // Ganti dengan nama file logo Telkom
              alt="Logo Telkom Indonesia"
              fill
              className="object-contain"
            />
          </div>

          {/* Logo Andantara (Opsional, kalo ada) */}
          <div className="w-24 h-24 relative">
            <Image
              src="/png danantara.png" // Ganti dengan nama file logo Andantara
              alt="Logo Andantara"
              fill
              className="object-contain"
            />
          </div>
        </div>

        {/* --- AKHIR BAGIAN LOGO --- */}

        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-2">
          Telkom Akses
        </h1>
        <p className="text-xl text-slate-600 mb-1">
          Monitoring Order
        </p>
        <p className="text-lg text-slate-500 mb-8">
          AREA 2
        </p>

        <div className="w-24 h-1 bg-blue-600 mx-auto mb-8"></div>

        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Dashboard monitoring untuk memantau performa order di AREA 2.
          Silakan masuk untuk melihat laporan harian.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-all hover:scale-105 flex items-center gap-2 mx-auto"
        >
          <FaBars size={18} />
          Masuk ke Dashboard
        </button>

        <div className="mt-12 text-xs text-slate-400">
          Rudi Narto Lutfianto • Developer
        </div>
      </div>
    </div>
  );
}