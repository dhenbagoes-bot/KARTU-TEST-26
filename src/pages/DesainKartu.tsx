import { useMemo, useState } from 'react';
import { Copy, Plus, Save, Trash2 } from 'lucide-react';
import { Kartu } from '../components/Kartu';
import { Btn, Card, Field, Input, Pesan, Select } from '../components/ui';
import { deleteTemplate, saveTemplate } from '../services/api';
import { DESAIN_DEFAULT, PRESET_DESAIN, templateBawaan, type DesainKartu, type TemplateKartu } from '../types';
import type { PageProps } from './PageProps';

export default function DesainKartu({ data, refresh, setPesanGlobal }: PageProps) {
  const templates = data.templates.length ? data.templates : templateBawaan();
  const contoh = data.pengguna[0] || { id: 'KID-0001', nama: 'Budi Santoso', username: 'budi.santoso', role: 'Siswa', kelas: '9A', fotoUrl: '', status: 'aktif', dicetak: 0, dibuatPada: '', diubahPada: '' };
  const [templateAktifId, setTemplateAktifId] = useState(templates[0]?.id || '');
  const aktif = templates.find((t) => t.id === templateAktifId) || templates[0];
  const [desain, setDesain] = useState<DesainKartu>(aktif?.desain || { ...DESAIN_DEFAULT });
  const [namaTemplate, setNamaTemplate] = useState(aktif?.nama || 'Kartu Siswa');
  const [roleTarget, setRoleTarget] = useState(aktif?.roleTarget || 'Semua');
  const [isDefault, setIsDefault] = useState(aktif?.isDefault ?? true);
  const [pesan, setPesan] = useState('');
  const [jenis, setJenis] = useState<'info' | 'sukses' | 'error'>('info');
  const [sibuk, setSibuk] = useState(false);

  const previewUser = useMemo(() => {
    if (roleTarget !== 'Semua') {
      const u = data.pengguna.find((p) => p.role === roleTarget);
      if (u) return u;
    }
    return contoh;
  }, [roleTarget, data.pengguna, contoh]);

  function pilihTemplate(t: TemplateKartu) {
    setTemplateAktifId(t.id);
    setDesain({ ...t.desain });
    setNamaTemplate(t.nama);
    setRoleTarget(t.roleTarget);
    setIsDefault(t.isDefault);
    setPesan('');
  }
  function baru() {
    setTemplateAktifId('');
    setDesain({ ...DESAIN_DEFAULT });
    setNamaTemplate('Template Baru');
    setRoleTarget('Semua');
    setIsDefault(false);
  }
  function ubah<K extends keyof DesainKartu>(kunci: K, nilai: DesainKartu[K]) {
    setDesain((d) => ({ ...d, [kunci]: nilai }));
  }
  function terapkanPreset(nama: string) {
    const p = PRESET_DESAIN.find((x) => x.nama === nama);
    if (p) setDesain((d) => ({ ...d, ...p.desain }));
  }

  async function simpan() {
    if (!namaTemplate.trim()) { setPesan('Nama template wajib diisi.'); setJenis('error'); return; }
    setSibuk(true);
    try {
      await saveTemplate({ id: templateAktifId || undefined, nama: namaTemplate.trim(), roleTarget, desainJson: JSON.stringify(desain), isDefault });
      setPesanGlobal(`Template "${namaTemplate.trim()}" tersimpan.`, 'sukses');
      setPesan('Template tersimpan.');
      setJenis('sukses');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal menyimpan template.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  async function hapus() {
    if (!templateAktifId) return;
    if (!window.confirm(`Hapus template "${namaTemplate}"?`)) return;
    setSibuk(true);
    try {
      await deleteTemplate(templateAktifId);
      setPesanGlobal('Template dihapus.', 'sukses');
      setTemplateAktifId('');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal menghapus template.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  async function duplikat() {
    setSibuk(true);
    try {
      await saveTemplate({ nama: `${namaTemplate.trim()} (Salinan)`, roleTarget, desainJson: JSON.stringify(desain), isDefault: false });
      setPesanGlobal('Template diduplikasi.', 'sukses');
      await refresh();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal menduplikasi template.'); setJenis('error');
    } finally { setSibuk(false); }
  }

  return (
    <div>
      <Card title="Template Kartu">
        <Pesan teks={pesan} jenis={jenis} />
        <div className="flex flex-wrap gap-2 mb-3">
          {templates.map((t) => (
            <button key={t.id} onClick={() => pilihTemplate(t)} className={`px-3 py-2 rounded-lg text-sm font-semibold border ${t.id === templateAktifId ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-slate-300'}`}>
              {t.nama} {t.isDefault ? '★' : ''} <span className="opacity-70 text-xs">({t.roleTarget})</span>
            </button>
          ))}
          <Btn warna="putih" onClick={baru}><span className="inline-flex items-center gap-1"><Plus size={15} /> Template Baru</span></Btn>
        </div>
        <p className="text-sm text-slate-600">Template bertanda ★ adalah template default untuk role tersebut — otomatis dipakai saat mencetak kartu pengguna dengan role itu (bisa diganti manual di halaman Cetak).</p>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Editor Desain">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nama Template"><Input value={namaTemplate} onChange={(e) => setNamaTemplate(e.target.value)} /></Field>
            <Field label="Untuk Role">
              <Select value={roleTarget} onChange={(e) => setRoleTarget(e.target.value)}>
                <option value="Semua">Semua Role</option>
                {['Admin', 'Guru', 'Siswa', 'Pegawai', 'Operator'].map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Preset Warna">
              <Select value="" onChange={(e) => { if (e.target.value) terapkanPreset(e.target.value); }}>
                <option value="">— Pilih preset —</option>
                {PRESET_DESAIN.map((p) => <option key={p.nama} value={p.nama}>{p.nama}</option>)}
              </Select>
            </Field>
            <Field label="Orientasi">
              <Select value={desain.orientasi} onChange={(e) => ubah('orientasi', e.target.value as DesainKartu['orientasi'])}>
                <option value="landscape">Landscape (85 × 55 mm)</option>
                <option value="portrait">Portrait (55 × 85 mm)</option>
              </Select>
            </Field>
            <Field label="Warna Utama"><Input type="color" value={desain.warnaUtama} onChange={(e) => ubah('warnaUtama', e.target.value)} /></Field>
            <Field label="Warna Kedua"><Input type="color" value={desain.warnaKedua} onChange={(e) => ubah('warnaKedua', e.target.value)} /></Field>
            <Field label="Warna Aksen (emas)"><Input type="color" value={desain.warnaAksen} onChange={(e) => ubah('warnaAksen', e.target.value)} /></Field>
            <Field label="Warna Teks"><Input type="color" value={desain.warnaTeks} onChange={(e) => ubah('warnaTeks', e.target.value)} /></Field>
            <Field label="Font">
              <Select value={desain.fontKeluarga} onChange={(e) => ubah('fontKeluarga', e.target.value)}>
                <option value="system-ui">Sistem (sans-serif)</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </Select>
            </Field>
            <Field label={`Ukuran Teks (${desain.ukuranTeks.toFixed(2)}x)`}>
              <input type="range" min={0.8} max={1.3} step={0.05} value={desain.ukuranTeks} onChange={(e) => ubah('ukuranTeks', Number(e.target.value))} className="w-full accent-emerald-700" />
            </Field>
            <Field label="Posisi Logo">
              <Select value={desain.posisiLogo} onChange={(e) => ubah('posisiLogo', e.target.value as DesainKartu['posisiLogo'])}>
                <option value="kiri">Kiri</option><option value="kanan">Kanan</option>
                <option value="tengah">Tengah</option><option value="sembunyi">Sembunyi</option>
              </Select>
            </Field>
            <Field label="Posisi Foto">
              <Select value={desain.posisiFoto} onChange={(e) => ubah('posisiFoto', e.target.value as DesainKartu['posisiFoto'])}>
                <option value="kiri">Kiri</option><option value="kanan">Kanan</option>
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 text-sm">
            {([['tampilId', 'Tampilkan ID'], ['tampilRole', 'Tampilkan Role'], ['tampilKelas', 'Tampilkan Kelas'], ['tampilLogo', 'Tampilkan Logo'], ['bingkai', 'Bingkai'], ['ornamen', 'Ornamen']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <input type="checkbox" checked={desain[k]} onChange={(e) => ubah(k, e.target.checked)} className="w-4 h-4 accent-emerald-700" /> {label}
              </label>
            ))}
            <label className="flex items-center gap-2 border border-yellow-300 bg-yellow-50 rounded-lg px-3 py-2">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="w-4 h-4 accent-yellow-600" /> Jadikan default untuk role ini ★
            </label>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Btn onClick={() => void simpan()} disabled={sibuk}><span className="inline-flex items-center gap-1"><Save size={15} /> Simpan Template</span></Btn>
            <Btn warna="putih" onClick={() => void duplikat()} disabled={sibuk}><span className="inline-flex items-center gap-1"><Copy size={15} /> Duplikat</span></Btn>
            {templateAktifId && <Btn warna="merah" onClick={() => void hapus()} disabled={sibuk}><span className="inline-flex items-center gap-1"><Trash2 size={15} /> Hapus</span></Btn>}
          </div>
        </Card>

        <Card title="Pratinjau Langsung">
          <p className="text-sm text-slate-500 mb-3">Contoh: {previewUser.nama} ({previewUser.role}{previewUser.kelas ? `, ${previewUser.kelas}` : ''}) — ukuran 85 × 55 mm, orientasi {desain.orientasi}.</p>
          <div className="flex justify-center bg-slate-100 rounded-xl p-4 overflow-x-auto">
            <Kartu user={previewUser} desain={desain} pengaturan={data.pengaturan} />
          </div>
          <p className="text-xs text-slate-500 mt-2">Logo instansi diatur di menu Konfigurasi. Bila pengguna belum punya foto, kartu menampilkan inisial nama (bukan foto orang lain).</p>
        </Card>
      </div>
    </div>
  );
}
