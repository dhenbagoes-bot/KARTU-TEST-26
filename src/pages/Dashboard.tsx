import { Camera, GraduationCap, IdCard, ImageOff, Layers, Users } from 'lucide-react';
import { Card } from '../components/ui';
import { fmtWaktu } from '../utils/format';
import { hitungStatistik } from '../utils/logika';
import type { PageProps } from './PageProps';

export default function Dashboard({ data, go }: PageProps) {
  const s = hitungStatistik(data.pengguna);
  const kartu: { label: string; nilai: number; ikon: React.ReactNode; warna: string }[] = [
    { label: 'Total Pengguna', nilai: s.totalPengguna, ikon: <Users size={22} />, warna: 'bg-emerald-100 text-emerald-700' },
    { label: 'Total Siswa', nilai: s.totalSiswa, ikon: <GraduationCap size={22} />, warna: 'bg-blue-100 text-blue-700' },
    { label: 'Total Guru', nilai: s.totalGuru, ikon: <Users size={22} />, warna: 'bg-amber-100 text-amber-700' },
    { label: 'Total Kelas', nilai: s.totalKelas, ikon: <Layers size={22} />, warna: 'bg-violet-100 text-violet-700' },
    { label: 'Foto Sudah Diunggah', nilai: s.totalFoto, ikon: <Camera size={22} />, warna: 'bg-emerald-100 text-emerald-700' },
    { label: 'Belum Punya Foto', nilai: s.belumPunyaFoto, ikon: <ImageOff size={22} />, warna: 'bg-red-100 text-red-700' },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {kartu.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${k.warna}`}>{k.ikon}</div>
            <div className="min-w-0">
              <div className="text-2xl font-black text-slate-800">{k.nilai}</div>
              <div className="text-xs text-slate-500">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card title="Tombol Cepat" aksi={undefined}>
        <div className="flex flex-wrap gap-2">
          <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-700 text-white" onClick={() => go('pengguna')}>+ Tambah Pengguna</button>
          <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-300" onClick={() => go('foto')}>Upload Foto Massal</button>
          <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-300" onClick={() => go('impor')}>Impor Excel</button>
          <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-slate-300" onClick={() => go('cetak')}><IdCard className="inline mr-1" size={15} /> Cetak Kartu</button>
        </div>
      </Card>

      <Card title="Aktivitas Terbaru">
        {data.log.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada aktivitas.</p>
        ) : (
          <ul className="text-sm divide-y divide-slate-100">
            {data.log.slice(0, 10).map((l) => (
              <li key={l.id} className="py-2 flex gap-3">
                <span className="text-slate-400 whitespace-nowrap">{fmtWaktu(l.waktu)}</span>
                <span className="font-semibold">{l.username}</span>
                <span className="text-slate-600 truncate">{l.aksi} — {l.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
