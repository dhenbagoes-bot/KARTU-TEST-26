import { useRef, useState } from 'react';
import { Link2, Save } from 'lucide-react';
import { Btn, Card, Field, Input, Pesan, Textarea } from '../components/ui';
import { getApiUrl, initDatabase, ping, savePengaturan, setApiUrl, setUrlEfektif, uploadLogo } from '../services/api';
import { bacaGambar } from '../utils/format';
import type { PageProps } from './PageProps';

export default function Konfigurasi({ data, refresh, setPesanGlobal }: PageProps) {
  const [url, setUrl] = useState(getApiUrl());
  const [form, setForm] = useState({
    namaInstansi: data.pengaturan.namaInstansi || 'Nama Instansi',
    alamatInstansi: data.pengaturan.alamatInstansi || '',
    teleponInstansi: data.pengaturan.teleponInstansi || '',
    kepalaInstansi: data.pengaturan.kepalaInstansi || '',
    tahun: data.pengaturan.tahun || '2026/2027',
    logoUrl: data.pengaturan.logoUrl || '',
  });
  const [pesan, setPesan] = useState('');
  const [jenis, setJenis] = useState<'info' | 'sukses' | 'error'>('info');
  const [sibuk, setSibuk] = useState(false);
  const inputLogo = useRef<HTMLInputElement>(null);

  function ubah(k: keyof typeof form, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function ujiKoneksi() {
    const u = url.trim();
    if (!u.startsWith('http')) { setPesan('Tempel URL backend /exec yang valid (diawali http).'); setJenis('error'); return; }
    setUrlEfektif(u); setApiUrl(u);
    setSibuk(true);
    try {
      const r = await ping();
      setPesan(`Tersambung! Backend versi ${r.version}, waktu server ${r.waktu}.`);
      setJenis('sukses');
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal tersambung.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  async function inisialisasi() {
    if (!window.confirm('Jalankan Inisialisasi Database? Sheet & header dibuat bila kosong; data yang sudah ada TIDAK dihapus. Akun bawaan dibuat HANYA bila sheet Pengguna masih kosong.')) return;
    setSibuk(true);
    try {
      const r = await initDatabase();
      setPesan(`Database siap (${r.sheets.join(', ')}). Silakan login dengan akun bawaan, lalu segera ganti kata sandi.`);
      setJenis('sukses');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Inisialisasi gagal.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  async function simpanIdentitas(e: React.FormEvent) {
    e.preventDefault();
    setSibuk(true);
    try {
      await savePengaturan(form);
      setPesanGlobal('Identitas instansi tersimpan.', 'sukses');
      setPesan('Identitas instansi tersimpan.');
      setJenis('sukses');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal menyimpan.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  async function pilihLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setSibuk(true);
    try {
      const g = await bacaGambar(f);
      const up = await uploadLogo(g.dataUrl, g.mimeType, f.name);
      ubah('logoUrl', up.url);
      await savePengaturan({ logoUrl: up.url });
      setPesan('Logo instansi berhasil diunggah dan tersimpan.');
      setJenis('sukses');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal mengunggah logo.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  return (
    <div>
      <Card title="Konfigurasi Backend">
        <Pesan teks={pesan} jenis={jenis} />
        <Field label="URL Backend Google Apps Script (/exec)">
          <div className="flex gap-2">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/AKfy.../exec" />
          </div>
        </Field>
        <div className="flex flex-wrap gap-2 mt-3">
          <Btn onClick={() => void ujiKoneksi()} disabled={sibuk}><span className="inline-flex items-center gap-1"><Link2 size={15} /> Uji Koneksi</span></Btn>
          <Btn warna="emas" onClick={() => void inisialisasi()} disabled={sibuk}>Inisialisasi Database</Btn>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Langkah backend ada di README.md: buat spreadsheet baru → Extensions → Apps Script (container-bound, jangan dari script.google.com) →
          paste <code>Kode.gs</code> → ganti <code>appsscript.json</code> → Deploy Web app → tempel URL /exec di sini.
        </p>
      </Card>

      <Card title="Identitas Instansi">
        <form onSubmit={simpanIdentitas} className="grid sm:grid-cols-2 gap-3">
          <Field label="Nama Instansi"><Input value={form.namaInstansi} onChange={(e) => ubah('namaInstansi', e.target.value)} /></Field>
          <Field label="Kepala Instansi"><Input value={form.kepalaInstansi} onChange={(e) => ubah('kepalaInstansi', e.target.value)} /></Field>
          <Field label="Telepon / Kontak"><Input value={form.teleponInstansi} onChange={(e) => ubah('teleponInstansi', e.target.value)} /></Field>
          <Field label="Tahun"><Input value={form.tahun} onChange={(e) => ubah('tahun', e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Alamat Instansi"><Textarea rows={2} value={form.alamatInstansi} onChange={(e) => ubah('alamatInstansi', e.target.value)} /></Field>
          </div>
          <div className="sm:col-span-2">
            <span className="block font-semibold text-slate-700 mb-1 text-sm">Logo Instansi</span>
            <div className="flex items-center gap-3">
              {form.logoUrl
                ? <img src={form.logoUrl} alt="Logo instansi" className="w-16 h-16 object-contain border rounded bg-white" />
                : <div className="w-16 h-16 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400 text-center">Belum ada logo</div>}
              <div>
                <input ref={inputLogo} type="file" accept="image/png,image/jpeg" className="hidden" onChange={pilihLogo} />
                <Btn warna="putih" onClick={() => inputLogo.current?.click()} disabled={sibuk}>Unggah Logo</Btn>
                <p className="text-xs text-slate-500 mt-1">Logo tampil di kartu sesuai posisi yang diatur di Desain Kartu.</p>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Btn type="submit" disabled={sibuk}><span className="inline-flex items-center gap-1"><Save size={15} /> Simpan Identitas</span></Btn>
          </div>
        </form>
      </Card>
    </div>
  );
}
