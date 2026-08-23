'use client';

import { useRouter } from 'next/navigation';
import { FaBars } from 'react-icons/fa';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center p-4">
      {/* Container */}
      <div className="max-w-2xl w-full text-center">
        {/* Logo / Ikon */}
        <div className="text-8xl mb-6">📡</div>
        
        {/* Judul */}
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-2">
          Telkom Akses
        </h1>
        <p className="text-xl text-slate-600 mb-1">
          Monitoring Order
        </p>
        <p className="text-lg text-slate-500 mb-8">
          AREA 2
        </p>

        {/* Garis Pemisah */}
        <div className="w-24 h-1 bg-blue-600 mx-auto mb-8"></div>

        {/* Deskripsi */}
        <p className="text-slate-600 mb-8 max-w-md mx-auto">
          Dashboard monitoring untuk memantau performa order di AREA 2.
          Silakan masuk untuk melihat laporan harian.
        </p>

        {/* Tombol Masuk */}
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-all hover:scale-105 flex items-center gap-2 mx-auto"
        >
          <FaBars size={18} />
          Masuk ke Dashboard
        </button>

        {/* Footer */}
        <div className="mt-12 text-xs text-slate-400">
          Rudi Narto Lutfianto • Developer
        </div>
      </div>
    </div>
  );
}