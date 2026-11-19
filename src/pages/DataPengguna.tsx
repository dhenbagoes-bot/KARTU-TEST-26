import { useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { Btn, Card, Field, Input, Pesan, Select } from '../components/ui';
import { addPengguna, deletePengguna, updatePengguna, uploadFoto } from '../services/api';
import type { PenggunaData } from '../types';
import { DAFTAR_PERAN } from '../types';
import { bacaGambar, validasiPenggunaForm } from '../utils/format';
import { eksporPenggunaExcel } from '../utils/excel';
import { buatPasswordAcak, filterPengguna, idBerikutnya, usernameDariNama } from '../utils/logika';
import type { PageProps } from './PageProps';

const FORM_KOSONG = { nama: '', username: '', password: '', role: 'Siswa', kelas: '', id: '' };

export default function DataPengguna({ data, user, refresh, setPesanGlobal }: PageProps) {
  const isAdmin = user.peran === 'Admin';
  const isSiswa = user.peran === 'Siswa';
  const [cari, setCari] = useState('');
  const [fRole, setFRole] = useState('Semua');
  const [fKelas, setFKelas] = useState('Semua');
  const [form, setForm] = useState(FORM_KOSONG);
  const [editId, setEditId] = useState('');
  const [formBuka, setFormBuka] = useState(false);
  const [pesan, setPesan] = useState('');
  const [jenis, setJenis] = useState<'info' | 'sukses' | 'error'>('info');
  const [sibuk, setSibuk] = useState(false);
  const [fotoBaru, setFotoBaru] = useState<{ dataUrl: string; mimeType: string } | null>(null);
  const [fotoLama, setFotoLama] = useState('');
  const [hapusId, setHapusId] = useState('');
  // Username = Nama Lengkap: selama belum diubah manual, username mengikuti Nama.
  const [usernameManual, setUsernameManual] = useState(false);
  const [passwordAcakTampil, setPasswordAcakTampil] = useState('');
  const inputFoto = useRef<HTMLInputElement>(null);

  const daftarKelas = useMemo(() => [...new Set(data.pengguna.map((u) => u.kelas).filter(Boolean))].sort(), [data.pengguna]);
  const tampil = useMemo(() => {
    let list = data.pengguna;
    // Siswa hanya melihat dirinya sendiri.
    if (isSiswa) list = list.filter((u) => u.username === user.username);
    return filterPengguna(list, cari, fRole, fKelas);
  }, [data.pengguna, cari, fRole, fKelas, isSiswa, user.username]);

  function mulaiTambah() {
    setForm({ ...FORM_KOSONG, id: idBerikutnya(data.pengguna) });
    setEditId(''); setFotoBaru(null); setFotoLama(''); setPesan(''); setFormBuka(true);
    setUsernameManual(false); setPasswordAcakTampil('');
  }
  function mulaiEdit(u: PenggunaData) {
    setForm({ nama: u.nama, username: u.username, password: '', role: u.role, kelas: u.kelas, id: u.id });
    setEditId(u.id); setFotoBaru(null); setFotoLama(u.fotoUrl); setPesan(''); setFormBuka(true);
    setUsernameManual(true); setPasswordAcakTampil('');
  }
  function batal() { setEditId(''); setForm(FORM_KOSONG); setFotoBaru(null); setFotoLama(''); setFormBuka(false); setUsernameManual(false); setPasswordAcakTampil(''); }

  /** Ketik Nama -> Username ikut terisi sama dengan Nama (selama belum diubah manual). */
  function ubahNama(namaBaru: string) {
    setForm((f) => ({ ...f, nama: namaBaru, username: usernameManual ? f.username : namaBaru }));
  }

  function acakPassword() {
    const acak = buatPasswordAcak();
    setForm((f) => ({ ...f, password: acak }));
    setPasswordAcakTampil(acak);
  }

  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (fotoLama && !fotoBaru) {
      if (!window.confirm('Pengguna ini sudah punya foto. Ganti dengan foto baru? Foto lama akan diganti setelah disimpan.')) {
        e.target.value = ''; return;
      }
    }
    try { setFotoBaru(await bacaGambar(f)); } catch (err) { setPesan(err instanceof Error ? err.message : 'Gagal membaca foto.'); setJenis('error'); }
    e.target.value = '';
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setPesan('');
    // Username kosong -> diisi dari Nama Lengkap (boleh berisi spasi).
    const usernameFinal = usernameDariNama(form.nama, form.username);
    const formFinal = { ...form, username: usernameFinal };
    const errs = validasiPenggunaForm({ ...formFinal, isBaru: !editId });
    if (errs.length) { setPesan(errs.join(' ')); setJenis('error'); return; }
    const duplikat = data.pengguna.some((u) => u.username.toLowerCase() === usernameFinal.toLowerCase() && u.id !== editId);
    if (duplikat) { setPesan(`Username ${usernameFinal} sudah dipakai pengguna lain.`); setJenis('error'); return; }
    setSibuk(true);
    try {
      if (editId) {
        // Pengguna sudah ada: foto bisa diunggah dulu, lalu simpan URL-nya.
        let fotoUrl = fotoLama;
        if (fotoBaru) {
          const up = await uploadFoto({ userId: editId, dataBase64: fotoBaru.dataUrl, mimeType: fotoBaru.mimeType, namaFile: `${usernameFinal}.jpg` });
          fotoUrl = up.url;
        }
        await updatePengguna({ id: editId, nama: form.nama.trim(), username: usernameFinal, password: form.password || undefined, role: form.role, kelas: form.kelas.trim(), fotoUrl });
        setPesanGlobal('Data pengguna diperbarui.', 'sukses');
      } else {
        // Pengguna baru: buat dulu (foto butuh userId yang sudah ada di sheet),
        // lalu unggah foto dan simpan URL-nya.
        const idTarget = form.id.trim() || idBerikutnya(data.pengguna);
        const dibuat = await addPengguna({ nama: form.nama.trim(), username: usernameFinal, password: form.password, role: form.role, kelas: form.kelas.trim(), id: idTarget, fotoUrl: '' });
        if (fotoBaru) {
          const up = await uploadFoto({ userId: dibuat.id, dataBase64: fotoBaru.dataUrl, mimeType: fotoBaru.mimeType, namaFile: `${usernameFinal}.jpg` });
          await updatePengguna({ id: dibuat.id, nama: form.nama.trim(), username: usernameFinal, role: form.role, kelas: form.kelas.trim(), fotoUrl: up.url });
        }
        setPesanGlobal(`Pengguna ditambahkan (ID ${dibuat.id}).` + (passwordAcakTampil ? ` Password acak: ${passwordAcakTampil} — catat sebelum lupa.` : ''), 'sukses');
      }
      batal();
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal menyimpan.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  async function konfirmasiHapus() {
    if (!hapusId) return;
    setSibuk(true);
    try {
      await deletePengguna(hapusId);
      setPesanGlobal('Pengguna dihapus.', 'sukses');
      setHapusId('');
      await refresh();
    } catch (err) { setPesan(err instanceof Error ? err.message : 'Gagal menghapus.'); setJenis('error'); }
    finally { setSibuk(false); }
  }

  return (
    <div>
      <Card title={isSiswa ? 'Kartu & Data Saya' : 'Data Pengguna'}>
        <Pesan teks={pesan} jenis={jenis} />
        {!isSiswa && (
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, username, kelas, atau ID..." />
            </div>
            <Select value={fRole} onChange={(e) => setFRole(e.target.value)} className="!w-auto">
              <option value="Semua">Semua Role</option>
              {DAFTAR_PERAN.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select value={fKelas} onChange={(e) => setFKelas(e.target.value)} className="!w-auto">
              <option value="Semua">Semua Kelas</option>
              {daftarKelas.map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
            <Btn warna="putih" onClick={() => eksporPenggunaExcel(tampil)}>Ekspor Excel</Btn>
            <Btn onClick={mulaiTambah}><span className="inline-flex items-center gap-1"><Plus size={15} /> Tambah</span></Btn>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-2">Foto</th><th className="py-2 pr-2">Nama</th><th className="py-2 pr-2">Username</th>
                <th className="py-2 pr-2">ID</th><th className="py-2 pr-2">Role</th><th className="py-2 pr-2">Kelas</th>
                <th className="py-2 pr-2">Status</th>{!isSiswa && <th className="py-2">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {tampil.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-slate-500">Tidak ada data yang cocok.</td></tr>}
              {tampil.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2">
                    {u.fotoUrl
                      ? <img src={u.fotoUrl} alt={u.nama} className="w-10 h-12 object-cover rounded" />
                      : <div className="w-10 h-12 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">{u.nama.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</div>}
                  </td>
                  <td className="py-2 pr-2 font-semibold">{u.nama}</td>
                  <td className="py-2 pr-2">@{u.username}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{u.id}</td>
                  <td className="py-2 pr-2">{u.role}</td>
                  <td className="py-2 pr-2">{u.kelas || '-'}</td>
                  <td className="py-2 pr-2">{u.dicetak ? 'Sudah dicetak' : u.status}</td>
                  {!isSiswa && (
                    <td className="py-2 whitespace-nowrap">
                      <button className="text-emerald-700 font-semibold mr-2 inline-flex items-center gap-1" onClick={() => mulaiEdit(u)}><Pencil size={14} /> Edit</button>
                      {isAdmin && <button className="text-red-600 font-semibold inline-flex items-center gap-1" onClick={() => setHapusId(u.id)}><Trash2 size={14} /> Hapus</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">Menampilkan {tampil.length} dari {data.pengguna.length} pengguna.</p>
      </Card>

      {hapusId && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="font-bold text-red-800 mb-1">Hapus pengguna ini?</p>
          <p className="text-sm text-red-700 mb-3">Data dan foto pengguna dengan ID {hapusId} akan dihapus. Tindakan ini tidak bisa dibatalkan.</p>
          <div className="flex gap-2">
            <Btn warna="merah" onClick={() => void konfirmasiHapus()} disabled={sibuk}>Ya, Hapus</Btn>
            <Btn warna="putih" onClick={() => setHapusId('')}>Batal</Btn>
          </div>
        </div>
      )}

      {!isSiswa && formBuka && (
        <Card title={editId ? `Edit Pengguna — ${form.nama || form.username}` : 'Tambah Pengguna Baru'}>
          <form onSubmit={simpan} className="grid sm:grid-cols-2 gap-3">
            <Field label="Nama Lengkap *"><Input value={form.nama} onChange={(e) => ubahNama(e.target.value)} placeholder="mis. Budi Santoso" /></Field>
            <Field label="Username *">
              <Input value={form.username} onChange={(e) => { setUsernameManual(true); setForm((f) => ({ ...f, username: e.target.value })); }} placeholder="otomatis = Nama Lengkap" />
              <button type="button" className="text-xs text-emerald-700 font-semibold mt-1" onClick={() => { setUsernameManual(false); setForm((f) => ({ ...f, username: f.nama })); }}>Samakan dengan Nama Lengkap</button>
            </Field>
            <Field label={editId ? 'Password (kosong = tidak diubah)' : 'Password *'}>
              <div className="flex gap-2">
                <Input type="password" value={form.password} onChange={(e) => { setPasswordAcakTampil(''); setForm((f) => ({ ...f, password: e.target.value })); }} placeholder="Minimal 6 karakter" />
                <Btn warna="putih" onClick={acakPassword}>Acak</Btn>
              </div>
              {passwordAcakTampil && <p className="text-xs text-emerald-700 mt-1">Password acak: <b>{passwordAcakTampil}</b> — catat sebelum Simpan.</p>}
            </Field>
            <Field label="Role *">
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {DAFTAR_PERAN.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Kelas (ketik bebas, mis. 9A)"><Input value={form.kelas} onChange={(e) => setForm((f) => ({ ...f, kelas: e.target.value }))} list="daftar-kelas" />
              <datalist id="daftar-kelas">{daftarKelas.map((k) => <option key={k} value={k} />)}</datalist>
            </Field>
            <Field label="ID (opsional — kosong = otomatis KID-0001, dst)"><Input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} /></Field>
            <div className="sm:col-span-2">
              <span className="block font-semibold text-slate-700 mb-1 text-sm">Foto</span>
              <div className="flex items-center gap-3">
                {(fotoBaru?.dataUrl || fotoLama)
                  ? <img src={fotoBaru?.dataUrl || fotoLama} alt="Pratinjau foto" className="w-16 h-20 object-cover rounded border" />
                  : <div className="w-16 h-20 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400 text-center">Belum ada foto</div>}
                <div>
                  <input ref={inputFoto} type="file" accept="image/jpeg,image/png" className="hidden" onChange={pilihFoto} />
                  <Btn warna="putih" onClick={() => inputFoto.current?.click()}><span className="inline-flex items-center gap-1"><Upload size={15} /> {fotoLama || fotoBaru ? 'Ganti Foto' : 'Unggah Foto'}</span></Btn>
                  {fotoBaru && <p className="text-xs text-emerald-700 mt-1">Foto baru dipilih — klik Simpan untuk mengunggahnya.</p>}
                </div>
              </div>
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Btn type="submit" disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan'}</Btn>
              <Btn warna="abu" onClick={batal}><span className="inline-flex items-center gap-1"><X size={15} /> Batal</span></Btn>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
