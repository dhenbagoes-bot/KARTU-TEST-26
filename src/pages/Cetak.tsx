import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Kartu } from '../components/Kartu';
import { Btn, Card, Field, Input, Pesan, Select } from '../components/ui';
import { tandaiDicetak } from '../services/api';
import { DESAIN_DEFAULT, templateBawaan, type TemplateKartu } from '../types';
import { bagiKeHalaman, filterPengguna, pilihTemplateUntukRole } from '../utils/logika';
import type { PageProps } from './PageProps';

export default function Cetak({ data, user, refresh, setPesanGlobal }: PageProps) {
  const isSiswa = user.peran === 'Siswa';
  const templates = data.templates.length ? data.templates : templateBawaan();
  const [cari, setCari] = useState('');
  const [fRole, setFRole] = useState('Semua');
  const [fKelas, setFKelas] = useState('Semua');
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [templateId, setTemplateId] = useState('');
  const [kolom, setKolom] = useState(2);
  const [baris, setBaris] = useState(4);
  const [jarak, setJarak] = useState(3);
  const [garisPotong, setGarisPotong] = useState(true);
  const [pesan, setPesan] = useState('');
  const [jenis, setJenis] = useState<'info' | 'sukses' | 'error'>('info');
  const [sibuk, setSibuk] = useState(false);

  const daftar = useMemo(() => {
    let list = data.pengguna;
    if (isSiswa) list = list.filter((u) => u.username === user.username);
    return filterPengguna(list, cari, fRole, fKelas);
  }, [data.pengguna, cari, fRole, fKelas, isSiswa, user.username]);
  const daftarKelas = useMemo(() => [...new Set(data.pengguna.map((u) => u.kelas).filter(Boolean))].sort(), [data.pengguna]);

  const dipilih = useMemo(() => daftar.filter((u) => terpilih.has(u.id)), [daftar, terpilih]);
  const halaman = useMemo(() => bagiKeHalaman(dipilih, kolom, baris), [dipilih, kolom, baris]);

  function desainUntuk(u: (typeof daftar)[number]): TemplateKartu['desain'] {
    if (templateId) {
      const t = templates.find((x) => x.id === templateId);
      if (t) return t.desain;
    }
    return pilihTemplateUntukRole(templates, u.role)?.desain || { ...DESAIN_DEFAULT };
  }

  function toggle(id: string) {
    setTerpilih((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function pilihSemuaTampil() { setTerpilih(new Set(daftar.map((u) => u.id))); }
  function bersihkan() { setTerpilih(new Set()); }

  function cetak() {
    if (!dipilih.length) { setPesan('Pilih minimal satu kartu untuk dicetak.'); setJenis('error'); return; }
    setPesan('');
    window.print();
  }

  async function tandai() {
    if (!dipilih.length) { setPesan('Pilih minimal satu kartu.'); setJenis('error'); return; }
    setSibuk(true);
    try {
      const hasil = await tandaiDicetak(dipilih.map((u) => u.id));
      setPesanGlobal(`${hasil.jumlah} kartu ditandai sudah dicetak.`, 'sukses');
      setPesan(`${hasil.jumlah} kartu ditandai sudah dicetak.`);
      setJenis('sukses');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal menandai.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  return (
    <div>
      <div className="no-print">
        <Card title="Cetak & Unduh Kartu (PDF lewat dialog cetak browser)">
          <Pesan teks={pesan} jenis={jenis} />
          <p className="text-sm text-slate-600 mb-3">
            Pilih kartu berdasarkan kelas, role, atau ceklis pengguna tertentu. Atur jumlah kartu per lembar A4,
            lalu klik <b>Cetak / Simpan PDF</b> — di dialog cetak pilih <b>Save as PDF</b> untuk mengunduh PDF, skala 100%, dan aktifkan <i>Background graphics</i> agar warna kartu ikut tercetak.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <Field label="Cari"><Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Nama, username, kelas, ID" /></Field>
            <Field label="Filter Role">
              <Select value={fRole} onChange={(e) => setFRole(e.target.value)}>
                <option value="Semua">Semua Role</option>
                {['Admin', 'Guru', 'Siswa', 'Pegawai', 'Operator'].map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Filter Kelas">
              <Select value={fKelas} onChange={(e) => setFKelas(e.target.value)}>
                <option value="Semua">Semua Kelas</option>
                {daftarKelas.map((k) => <option key={k} value={k}>{k}</option>)}
              </Select>
            </Field>
            <Field label="Template (kosong = default per role)">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Default per Role</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.nama} ({t.roleTarget})</option>)}
              </Select>
            </Field>
            <Field label="Kolom per Halaman A4"><Input type="number" min={1} max={4} value={kolom} onChange={(e) => setKolom(Math.max(1, Math.min(4, Number(e.target.value) || 1)))} /></Field>
            <Field label="Baris per Halaman A4"><Input type="number" min={1} max={6} value={baris} onChange={(e) => setBaris(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} /></Field>
            <Field label="Jarak Antar Kartu (mm)"><Input type="number" min={0} max={10} value={jarak} onChange={(e) => setJarak(Math.max(0, Math.min(10, Number(e.target.value) || 0)))} /></Field>
            <label className="flex items-end gap-2 text-sm pb-2">
              <input type="checkbox" checked={garisPotong} onChange={(e) => setGarisPotong(e.target.checked)} className="w-4 h-4 accent-emerald-700" /> Garis potong
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn warna="putih" onClick={pilihSemuaTampil}>Pilih Semua ({daftar.length})</Btn>
            <Btn warna="putih" onClick={bersihkan}>Bersihkan Pilihan</Btn>
            <Btn onClick={cetak} disabled={!dipilih.length}><span className="inline-flex items-center gap-1"><Printer size={15} /> Cetak / Simpan PDF ({dipilih.length})</span></Btn>
            <Btn warna="emas" onClick={() => void tandai()} disabled={!dipilih.length || sibuk}>Tandai Sudah Dicetak</Btn>
          </div>
          <p className="text-xs text-slate-500 mt-2">{dipilih.length} kartu dipilih • {halaman.length} halaman A4 ({kolom} × {baris} per halaman).</p>
        </Card>

        <Card title="Pilih Kartu">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-2"><input type="checkbox" checked={daftar.length > 0 && daftar.every((u) => terpilih.has(u.id))} onChange={() => (daftar.every((u) => terpilih.has(u.id)) ? bersihkan() : pilihSemuaTampil())} className="w-4 h-4 accent-emerald-700" /></th>
                  <th className="py-2 pr-2">Nama</th><th className="py-2 pr-2">Username</th><th className="py-2 pr-2">Role</th><th className="py-2 pr-2">Kelas</th><th className="py-2">Status Cetak</th>
                </tr>
              </thead>
              <tbody>
                {daftar.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-500">Tidak ada data yang cocok.</td></tr>}
                {daftar.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2"><input type="checkbox" checked={terpilih.has(u.id)} onChange={() => toggle(u.id)} className="w-4 h-4 accent-emerald-700" /></td>
                    <td className="py-2 pr-2 font-semibold">{u.nama}</td>
                    <td className="py-2 pr-2">@{u.username}</td>
                    <td className="py-2 pr-2">{u.role}</td>
                    <td className="py-2 pr-2">{u.kelas || '-'}</td>
                    <td className="py-2">{u.dicetak ? 'Sudah dicetak' : 'Belum'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Area cetak — hanya ini yang keluar di print/PDF. */}
      {dipilih.length > 0 && (
        <div id="print-area" className="hidden print:block">
          {halaman.map((hal, hi) => (
            <div key={hi} className="print-page" style={{ display: 'grid', gridTemplateColumns: `repeat(${kolom}, 85mm)`, gap: `${jarak}mm`, justifyContent: 'start', marginBottom: '5mm' }}>
              {hal.map((u) => (
                <div key={u.id} style={garisPotong ? { outline: '0.3mm dashed #94a3b8', outlineOffset: '0.8mm' } : undefined}>
                  <Kartu user={u} desain={desainUntuk(u)} pengaturan={data.pengaturan} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {/* Pratinjau layar (bukan area cetak). */}
      {dipilih.length > 0 && (
        <div className="no-print">
          <Card title={`Pratinjau Cetak — ${dipilih.length} kartu, ${halaman.length} halaman`}>
            <div className="flex flex-wrap gap-3 bg-slate-100 rounded-xl p-4">
              {dipilih.slice(0, 8).map((u) => <Kartu key={u.id} user={u} desain={desainUntuk(u)} pengaturan={data.pengaturan} />)}
              {dipilih.length > 8 && <p className="text-sm text-slate-500 self-center">+ {dipilih.length - 8} kartu lagi…</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
