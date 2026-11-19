import { useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Upload, XCircle } from 'lucide-react';
import { Btn, Card, Pesan } from '../components/ui';
import { uploadFotoMassal } from '../services/api';
import { bacaGambar } from '../utils/format';
import { cocokkanFotoMassal, fotoValid, type PasanganFoto } from '../utils/logika';
import type { PageProps } from './PageProps';

interface ItemFoto {
  file: File;
  dataUrl: string;
  mimeType: string;
  pasangan: PasanganFoto;
  status: 'menunggu' | 'berhasil' | 'gagal' | 'ditolak';
  alasan: string;
}

export default function UploadFoto({ data, refresh, setPesanGlobal }: PageProps) {
  const [items, setItems] = useState<ItemFoto[]>([]);
  const [timpa, setTimpa] = useState(false);
  const [pesan, setPesan] = useState('');
  const [jenis, setJenis] = useState<'info' | 'sukses' | 'error'>('info');
  const [sibuk, setSibuk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pilihFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const pasangan = cocokkanFotoMassal(files.map((f) => f.name), data.pengguna);
    const baru: ItemFoto[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const p = pasangan[i];
      const alasanFormat = fotoValid(f.name, f.type);
      if (alasanFormat) {
        baru.push({ file: f, dataUrl: '', mimeType: f.type, pasangan: p, status: 'ditolak', alasan: alasanFormat });
        continue;
      }
      try {
        const g = await bacaGambar(f);
        const target = p.cocokId ? data.pengguna.find((u) => u.id === p.cocokId) : undefined;
        if (target?.fotoUrl && !timpa) {
          baru.push({ file: f, dataUrl: g.dataUrl, mimeType: g.mimeType, pasangan: p, status: 'ditolak', alasan: `${target.nama} sudah punya foto — aktifkan "Timpa foto yang sudah ada" untuk menggantinya.` });
        } else {
          baru.push({ file: f, dataUrl: g.dataUrl, mimeType: g.mimeType, pasangan: p, status: 'menunggu', alasan: p.alasan || '' });
        }
      } catch (err) {
        baru.push({ file: f, dataUrl: '', mimeType: f.type, pasangan: p, status: 'ditolak', alasan: err instanceof Error ? err.message : 'Gagal membaca file.' });
      }
    }
    setItems((prev) => [...prev, ...baru]);
    const cocok = baru.filter((b) => b.pasangan.cocokId && b.status === 'menunggu').length;
    const takCocok = baru.filter((b) => !b.pasangan.cocokId).length;
    setPesan(`${files.length} file dipilih: ${cocok} cocok dengan pengguna, ${takCocok} tidak cocok, ${baru.filter((b) => b.status === 'ditolak').length} ditolak. Periksa pratinjau sebelum memproses.`);
    setJenis('info');
  }

  const siap = items.filter((i) => i.status === 'menunggu' && i.pasangan.cocokId);
  const takCocok = items.filter((i) => !i.pasangan.cocokId);

  async function proses() {
    if (!siap.length) { setPesan('Tidak ada foto yang siap diproses (harus cocok dengan username/ID pengguna).'); setJenis('error'); return; }
    if (timpa && !window.confirm(`Mode timpa AKTIF: ${siap.filter((i) => data.pengguna.find((u) => u.id === i.pasangan.cocokId)?.fotoUrl).length} foto lama akan diganti. Lanjutkan?`)) return;
    setSibuk(true);
    try {
      const hasil = await uploadFotoMassal(siap.map((i) => ({ userId: i.pasangan.cocokId!, dataBase64: i.dataUrl, mimeType: i.mimeType, namaFile: i.file.name })));
      const gagalSet = new Map(hasil.gagal.map((g) => [g.namaFile, g.alasan]));
      setItems((prev) => prev.map((i) => {
        if (i.status !== 'menunggu' || !i.pasangan.cocokId) return i;
        const alasan = gagalSet.get(i.file.name);
        return alasan ? { ...i, status: 'gagal', alasan } : { ...i, status: 'berhasil', alasan: '' };
      }));
      setPesan(`Upload massal selesai: ${hasil.berhasil} berhasil, ${hasil.gagal.length} gagal.`);
      setJenis(hasil.gagal.length ? 'error' : 'sukses');
      setPesanGlobal(`Upload foto massal: ${hasil.berhasil} berhasil, ${hasil.gagal.length} gagal.`, hasil.gagal.length ? 'error' : 'sukses');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Upload massal gagal.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  return (
    <div>
      <Card title="Upload Foto Massal" aksi={<Btn warna="putih" onClick={() => setItems([])}>Bersihkan Daftar</Btn>}>
        <Pesan teks={pesan} jenis={jenis} />
        <p className="text-sm text-slate-600 mb-3">
          Pilih banyak foto sekaligus (JPG / JPEG / PNG). Nama file harus sama dengan <b>username</b> atau <b>ID</b> pengguna, contoh: <code className="bg-slate-100 px-1 rounded">budi.jpg</code> atau <code className="bg-slate-100 px-1 rounded">KID-0001.png</code>.
          Foto yang tidak cocok tidak akan diproses. Foto yang sudah tersimpan <b>tidak ditimpa</b> kecuali Anda mengaktifkan mode timpa.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={pilihFiles} />
          <Btn onClick={() => inputRef.current?.click()}><span className="inline-flex items-center gap-1"><ImagePlus size={15} /> Pilih Foto (banyak)</span></Btn>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={timpa} onChange={(e) => setTimpa(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
            Timpa foto yang sudah ada
          </label>
          <Btn warna="emas" disabled={!siap.length || sibuk} onClick={() => void proses()}>
            <span className="inline-flex items-center gap-1"><Upload size={15} /> Proses {siap.length} Foto</span>
          </Btn>
        </div>

        {items.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it, idx) => (
              <div key={`${it.file.name}-${idx}`} className="border border-slate-200 rounded-xl p-3 flex gap-3">
                {it.dataUrl
                  ? <img src={it.dataUrl} alt={it.file.name} className="w-16 h-20 object-cover rounded border shrink-0" />
                  : <div className="w-16 h-20 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400 shrink-0">Tidak ada pratinjau</div>}
                <div className="min-w-0 text-sm">
                  <div className="font-semibold truncate" title={it.file.name}>{it.file.name}</div>
                  {it.pasangan.cocokId
                    ? <div className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={14} /> {it.pasangan.cocokNama}</div>
                    : <div className="text-red-600 inline-flex items-center gap-1"><XCircle size={14} /> Tidak cocok</div>}
                  <div className="text-xs text-slate-500 break-words">{it.status === 'berhasil' ? 'Berhasil diunggah.' : it.alasan || it.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {takCocok.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <b>{takCocok.length} file tidak cocok</b> dengan username/ID pengguna mana pun dan tidak akan diproses:
            <ul className="list-disc ml-5 mt-1">{takCocok.map((t, i) => <li key={i}>{t.file.name} — {t.alasan}</li>)}</ul>
          </div>
        )}
      </Card>
    </div>
  );
}
