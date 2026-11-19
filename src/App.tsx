import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Camera, DatabaseBackup, FileSpreadsheet, Home, IdCard, LogOut, Palette, Settings, Users } from 'lucide-react';
import { Btn, Pesan } from './components/ui';
import Dashboard from './pages/Dashboard';
import DataPengguna from './pages/DataPengguna';
import UploadFoto from './pages/UploadFoto';
import ImporExcel from './pages/ImporExcel';
import DesainKartu from './pages/DesainKartu';
import Cetak from './pages/Cetak';
import Konfigurasi from './pages/Konfigurasi';
import Backup from './pages/Backup';
import Panduan from './pages/Panduan';
import Login from './pages/Login';
import { getAllData, getApiUrl, getSesiTersimpan, initDatabase, isLoggedIn, logout, ping, setApiUrl, setUrlEfektif } from './services/api';
import type { AllData, UserSesi } from './types';

type Halaman = 'dashboard' | 'pengguna' | 'foto' | 'impor' | 'desain' | 'cetak' | 'konfigurasi' | 'backup' | 'panduan';

const MENU: { id: Halaman; label: string; ikon: React.ReactNode; adminSaja?: boolean; guruBoleh?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', ikon: <Home size={17} /> },
  { id: 'pengguna', label: 'Data Pengguna', ikon: <Users size={17} /> },
  { id: 'foto', label: 'Upload Foto Massal', ikon: <Camera size={17} />, guruBoleh: true },
  { id: 'impor', label: 'Impor Excel', ikon: <FileSpreadsheet size={17} />, guruBoleh: true },
  { id: 'desain', label: 'Desain Kartu', ikon: <Palette size={17} />, guruBoleh: true },
  { id: 'cetak', label: 'Cetak Kartu', ikon: <IdCard size={17} />, guruBoleh: true },
  { id: 'konfigurasi', label: 'Konfigurasi', ikon: <Settings size={17} />, adminSaja: true },
  { id: 'backup', label: 'Backup & Restore', ikon: <DatabaseBackup size={17} />, adminSaja: true },
  { id: 'panduan', label: 'Panduan', ikon: <BookOpen size={17} /> },
];

export default function App() {
  const [user, setUser] = useState<UserSesi | null>(null);
  const [data, setData] = useState<AllData | null>(null);
  const [page, setPage] = useState<Halaman>('dashboard');
  const [halamanKhusus, setHalamanKhusus] = useState<'login' | 'konfigurasi' | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [pesanGlobal, setPesanGlobal] = useState('');
  const [jenisGlobal, setJenisGlobal] = useState<'info' | 'sukses' | 'error'>('info');
  const [sidebarBuka, setSidebarBuka] = useState(false);

  const setPesan = useCallback((pesan: string, jenis: 'info' | 'sukses' | 'error' = 'info') => {
    setPesanGlobal(pesan); setJenisGlobal(jenis);
  }, []);

  const muatData = useCallback(async () => {
    try {
      const d = await getAllData();
      setData(d);
      setGalat('');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat data.');
      throw e;
    }
  }, []);

  // Resolusi backend: ?school= + schools.json, override manual di localStorage menang.
  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const schoolId = params.get('school');
        const res = await fetch('/schools.json');
        const list = (await res.json()) as { id: string; nama: string; apiUrl: string }[];
        if (batal) return;
        const manual = getApiUrl();
        if (!manual && schoolId) {
          const s = list.find((x) => x.id === schoolId);
          if (s?.apiUrl) setUrlEfektif(s.apiUrl);
        } else if (!manual && list.length === 1 && list[0].apiUrl) {
          setUrlEfektif(list[0].apiUrl);
        }
      } catch { /* schools.json opsional; URL manual tetap bisa dipakai */ }
      if (batal) return;
      if (isLoggedIn()) {
        const sesi = getSesiTersimpan();
        if (sesi) setUser(sesi);
        try { await muatData(); } catch { /* token mati -> tetap di login, Konfigurasi tetap bisa dibuka */ }
      }
      setMemuat(false);
    })();
    return () => { batal = true; };
  }, [muatData]);

  async function keluar() {
    await logout();
    setUser(null); setData(null); setPage('dashboard');
  }

  function go(p: string) {
    if (p === 'keluar') { void keluar(); return; }
    setPage(p as Halaman);
    setSidebarBuka(false);
    setPesanGlobal('');
  }

  // Halaman khusus: Konfigurasi SELALU bisa dirender walau getAllData gagal —
  // supaya pengguna tidak terjebak layar error dan tetap bisa menempel URL backend.
  if (halamanKhusus === 'konfigurasi') {
    if (!data) {
      return (
        <div className="min-h-screen bg-slate-100 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
              <h1 className="font-bold text-lg mb-1">Konfigurasi Backend</h1>
              <p className="text-sm text-slate-600 mb-3">Tempel URL backend Google Apps Script (/exec) di bawah ini, lalu Uji Koneksi. Setelah tersambung, klik Inisialisasi Database, lalu kembali dan login.</p>
              <Pesan teks={galat} jenis="error" />
              <KonfigurasiAwal onKembali={() => setHalamanKhusus(user ? null : 'login')} onTersambung={() => { if (user) void muatData().catch(() => undefined); }} />
            </div>
          </div>
        </div>
      );
    }
    return <KonfigurasiHalaman data={data} user={user} refresh={muatData} go={go} setPesanGlobal={setPesan} onKembali={() => setHalamanKhusus(null)} />;
  }

  if (memuat) {
    return <div className="min-h-screen flex items-center justify-center text-slate-600">Memuat aplikasi...</div>;
  }

  if (!user) {
    return <Login onLogin={(u) => { setUser(u); setHalamanKhusus(null); void muatData().catch(() => undefined); }} goKonfigurasi={() => setHalamanKhusus('konfigurasi')} />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border p-5">
          <h1 className="font-bold mb-2">Belum bisa memuat data</h1>
          <Pesan teks={galat || 'Periksa URL backend di Konfigurasi, lalu coba lagi.'} jenis="error" />
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setHalamanKhusus('konfigurasi')}>Buka Konfigurasi</Btn>
            <Btn warna="putih" onClick={() => void muatData().catch(() => undefined)}>Coba Lagi</Btn>
            <Btn warna="abu" onClick={() => void keluar()}>Keluar</Btn>
          </div>
        </div>
      </div>
    );
  }

  const props = { data, user, refresh: muatData, go, setPesanGlobal: setPesan };
  const isAdmin = user.peran === 'Admin';
  const isSiswa = user.peran === 'Siswa';
  const menuTampil = MENU.filter((m) => {
    if (isSiswa) return m.id === 'dashboard' || m.id === 'pengguna' || m.id === 'cetak' || m.id === 'panduan';
    if (m.adminSaja) return isAdmin;
    return true;
  });

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-emerald-900 text-white p-4 transform transition-transform lg:static lg:transform-none ${sidebarBuka ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="mb-4">
          <div className="font-black text-lg leading-tight flex items-center gap-2"><IdCard size={22} className="text-yellow-400" /> KARTU IDENTITAS</div>
          <div className="text-emerald-200 text-sm">{data.pengaturan.namaInstansi || 'Nama Instansi'}</div>
          <div className="text-emerald-300 text-xs mt-1">{data.pengaturan.alamatInstansi}</div>
          <div className="text-yellow-400 text-xs mt-2 font-semibold">v{data.version || '1.0.0'}</div>
        </div>
        <nav className="space-y-1">
          {menuTampil.map((m) => (
            <button key={m.id} onClick={() => go(m.id)} className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${page === m.id ? 'bg-emerald-700' : 'hover:bg-emerald-800'}`}>{m.ikon} {m.label}</button>
          ))}
          <button onClick={() => void keluar()} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 mt-2"><LogOut size={17} /> Keluar</button>
        </nav>
        <div className="text-xs text-emerald-300 mt-6">Masuk sebagai {user.nama} ({user.peran})</div>
      </aside>
      {sidebarBuka && <div className="no-print fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarBuka(false)} />}

      <div className="flex-1 min-w-0">
        <header className="no-print bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button className="lg:hidden text-2xl" onClick={() => setSidebarBuka(true)} aria-label="Buka menu">☰</button>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{data.pengaturan.namaInstansi || 'Nama Instansi'}</div>
            <div className="text-xs text-slate-500 truncate">Tahun {data.pengaturan.tahun || '-'} • {user.nama} ({user.peran})</div>
          </div>
          <Btn warna="putih" onClick={() => void muatData().catch(() => undefined)}>Muat Ulang</Btn>
        </header>
        <main className="p-4 max-w-6xl mx-auto">
          <Pesan teks={pesanGlobal} jenis={jenisGlobal} />
          {galat && <Pesan teks={galat} jenis="error" />}
          {page === 'dashboard' && <Dashboard {...props} />}
          {page === 'pengguna' && <DataPengguna {...props} />}
          {page === 'foto' && !isSiswa && <UploadFoto {...props} />}
          {page === 'impor' && !isSiswa && <ImporExcel {...props} />}
          {page === 'desain' && !isSiswa && <DesainKartu {...props} />}
          {page === 'cetak' && <Cetak {...props} />}
          {page === 'konfigurasi' && isAdmin && <KonfigurasiHalaman data={data} user={user} refresh={muatData} go={go} setPesanGlobal={setPesan} onKembali={() => setPage('dashboard')} />}
          {page === 'backup' && isAdmin && <Backup {...props} />}
          {page === 'panduan' && <Panduan />}
        </main>
      </div>
    </div>
  );
}

/** Bungkus halaman Konfigurasi dengan tombol kembali (dipakai dari menu & dari layar khusus). */
function KonfigurasiHalaman({ data, user, refresh, go, setPesanGlobal, onKembali }: { data: AllData; user: UserSesi | null; refresh: () => Promise<void>; go: (p: string) => void; setPesanGlobal: (p: string, j?: 'info' | 'sukses' | 'error') => void; onKembali: () => void }) {
  return (
    <div>
      <button className="text-emerald-700 font-semibold text-sm mb-3 no-print" onClick={onKembali}>← Kembali</button>
      <Konfigurasi data={data} user={user!} refresh={refresh} go={go} setPesanGlobal={setPesanGlobal} />
    </div>
  );
}

/** Konfigurasi backend saja — tanpa data (dipakai saat getAllData gagal / belum login). */
function KonfigurasiAwal({ onKembali, onTersambung }: { onKembali: () => void; onTersambung: () => void }) {
  const [url, setUrl] = useState(getApiUrl());
  const [pesan, setPesan] = useState('');
  const [jenis, setJenis] = useState<'info' | 'sukses' | 'error'>('info');
  const [sibuk, setSibuk] = useState(false);
  const [ok, setOk] = useState(false);

  async function uji() {
    const u = url.trim();
    if (!u.startsWith('http')) { setPesan('Tempel URL backend /exec yang valid (diawali http).'); setJenis('error'); return; }
    setUrlEfektif(u); setApiUrl(u);
    setSibuk(true);
    try {
      const r = await ping();
      setPesan(`Tersambung! Backend versi ${r.version}. Lanjutkan: Inisialisasi Database, lalu kembali & login.`);
      setJenis('sukses'); setOk(true);
      onTersambung();
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal tersambung.'); setJenis('error');
    } finally { setSibuk(false); }
  }
  async function init() {
    setSibuk(true);
    try {
      const r = await initDatabase();
      setPesan(`Database siap (${r.sheets.join(', ')}). Akun bawaan dibuat bila sheet masih kosong — segera ganti kata sandi setelah login pertama.`);
      setJenis('sukses');
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Inisialisasi gagal.'); setJenis('error');
    } finally { setSibuk(false); }
  }
  return (
    <div>
      <Pesan teks={pesan} jenis={jenis} />
      <label className="block text-sm"><span className="block font-semibold text-slate-700 mb-1">URL Backend Google Apps Script (/exec)</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/AKfy.../exec" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </label>
      <div className="flex flex-wrap gap-2 mt-3">
        <Btn onClick={() => void uji()} disabled={sibuk}>Uji Koneksi</Btn>
        <Btn warna="emas" onClick={() => void init()} disabled={sibuk || !ok}>Inisialisasi Database</Btn>
        <Btn warna="putih" onClick={onKembali}>Kembali</Btn>
      </div>
      <p className="text-xs text-slate-500 mt-2">Lihat README.md untuk langkah backend lengkap (spreadsheet → Extensions → Apps Script → Deploy).</p>
    </div>
  );
}
