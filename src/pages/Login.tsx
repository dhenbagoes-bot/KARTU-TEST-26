import { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Btn, Input, Pesan } from '../components/ui';
import { login } from '../services/api';
import type { UserSesi } from '../types';

export default function Login({ onLogin, goKonfigurasi }: { onLogin: (u: UserSesi) => void; goKonfigurasi: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pesan, setPesan] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setPesan('');
    if (!username.trim() || !password) { setPesan('Isi username dan kata sandi.'); return; }
    setSibuk(true);
    try {
      const u = await login(username, password);
      onLogin(u);
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Login gagal.');
    } finally { setSibuk(false); }
  }

  return (
    <div className="min-h-screen bg-emerald-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mb-3"><ShieldCheck size={28} /></div>
          <h1 className="text-xl font-black text-slate-800">KARTU IDENTITAS</h1>
          <p className="text-sm text-slate-500">Manajemen Data &amp; Cetak Kartu Identitas</p>
          <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-3">
            Akun bawaan hanya untuk penyiapan awal. Segera ganti kata sandi setelah login pertama (lihat Panduan &amp; README).
          </p>
        </div>
        <Pesan teks={pesan} jenis="error" />
        <form onSubmit={kirim} className="space-y-3">
          <label className="block text-sm"><span className="block font-semibold text-slate-700 mb-1">Username</span>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="Nama Lengkap (mis. Budi Santoso)" />
          </label>
          <label className="block text-sm"><span className="block font-semibold text-slate-700 mb-1">Kata Sandi</span>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Kata sandi" />
          </label>
          <Btn type="submit" disabled={sibuk} warna="hijau">
            <span className="inline-flex items-center gap-2"><LogIn size={16} /> {sibuk ? 'Memeriksa...' : 'Masuk'}</span>
          </Btn>
        </form>
        <button className="text-emerald-700 text-sm font-semibold mt-4 w-full text-center" onClick={goKonfigurasi}>
          Konfigurasi Backend (URL Google Apps Script)
        </button>
      </div>
    </div>
  );
}
