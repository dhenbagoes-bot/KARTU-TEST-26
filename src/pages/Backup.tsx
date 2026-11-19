import { useRef, useState } from 'react';
import { DatabaseBackup, Download, RotateCcw } from 'lucide-react';
import { Btn, Card, Pesan } from '../components/ui';
import { backupData, restoreData } from '../services/api';
import { unduhTeks } from '../utils/format';
import type { PageProps } from './PageProps';

export default function Backup({ data, refresh, setPesanGlobal }: PageProps) {
  const [pesan, setPesan] = useState('');
  const [jenis, setJenis] = useState<'info' | 'sukses' | 'error'>('info');
  const [sibuk, setSibuk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function unduhBackup() {
    setSibuk(true);
    try {
      const b = await backupData();
      const nama = `backup-kartu-identitas-${new Date().toISOString().slice(0, 10)}.json`;
      unduhTeks(nama, JSON.stringify({ aplikasi: 'wwn-kartu-identitas-80', versi: b.version, dieksporPada: new Date().toISOString(), ...b }, null, 2));
      setPesan(`Backup diunduh (${nama}). Simpan file ini di tempat aman.`);
      setJenis('sukses');
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Backup gagal.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  async function pilihFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    let isi: { pengguna?: unknown[]; pengaturan?: unknown; templates?: unknown[] };
    try {
      isi = JSON.parse(await f.text()) as typeof isi;
    } catch {
      setPesan('File backup tidak valid (bukan JSON).'); setJenis('error'); return;
    }
    if (!Array.isArray(isi.pengguna)) { setPesan('File backup tidak berisi daftar pengguna.'); setJenis('error'); return; }
    if (!window.confirm(`Pulihkan backup ini? Hanya data yang BELUM ADA yang ditambahkan (berdasarkan username/ID). Data yang sudah ada TIDAK ditimpa dan TIDAK dihapus. ${isi.pengguna.length} pengguna di dalam file.`)) return;
    setSibuk(true);
    try {
      const hasil = await restoreData(isi as never);
      setPesan(`Restore selesai: ${hasil.ditambah} pengguna ditambahkan, ${hasil.dilewati} dilewati (sudah ada).`);
      setJenis('sukses');
      setPesanGlobal(`Restore backup: ${hasil.ditambah} ditambahkan, ${hasil.dilewati} dilewati.`, 'sukses');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Restore gagal.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  return (
    <div>
      <Card title="Backup & Restore Data">
        <Pesan teks={pesan} jenis={jenis} />
        <p className="text-sm text-slate-600 mb-3">
          Data utama tersimpan di Google Sheets (cloud) — tetap ada walau ganti perangkat/browser.
          Backup JSON ini adalah salinan cadangan: pengaturan, seluruh pengguna, template kartu, dan log aktivitas.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm mb-4">
          <b>Ringkasan data saat ini:</b> {data.pengguna.length} pengguna • {data.templates.length} template kartu • {data.log.length} entri log • Instansi: {data.pengaturan.namaInstansi || '-'}
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => void unduhBackup()} disabled={sibuk}><span className="inline-flex items-center gap-1"><Download size={15} /> Unduh Backup JSON</span></Btn>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={pilihFile} />
          <Btn warna="emas" onClick={() => inputRef.current?.click()} disabled={sibuk}><span className="inline-flex items-center gap-1"><RotateCcw size={15} /> Pulihkan dari Backup</span></Btn>
        </div>
        <p className="text-xs text-slate-500 mt-3 flex items-start gap-1"><DatabaseBackup size={14} className="shrink-0 mt-0.5" /> Restore bersifat aman-menambah: username/ID yang sudah ada dilewati, tidak ada data lama yang ditimpa atau dihapus.</p>
      </Card>
    </div>
  );
}
