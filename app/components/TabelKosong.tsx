'use client';

export default function TabelKosong({ title }: { title: string }) {
  return (
    <div className="bg-white p-12 rounded-lg shadow-md text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h2 className="text-2xl font-bold text-slate-700 mb-2">COMING SOON</h2>
      <p className="text-slate-500">
        Dashboard untuk <strong>{title}</strong> sedang dalam pengembangan.
      </p>
      <p className="text-slate-400 text-sm mt-2">Mohon bersabar ya! 😊</p>
    </div>
  );
}