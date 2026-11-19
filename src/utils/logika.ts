import type { PenggunaData, TemplateKartu } from '../types';

/** Normalisasi kunci pencocokan: huruf kecil, tanpa titik/spasi/underscore/dash. */
export function normalisasiKunci(s: string): string {
  return (s || '').trim().toLowerCase().replace(/[._\-\s]+/g, '');
}

/** Ambil nama file tanpa ekstensi (untuk pencocokan foto massal). */
export function kunciDariNamaFile(namaFile: string): string {
  const dasar = (namaFile || '').split(/[\\/]/).pop() || '';
  const tanpaEkst = dasar.replace(/\.[^.]+$/, '');
  return normalisasiKunci(tanpaEkst);
}

export function ekstensiFile(namaFile: string): string {
  const m = /\.([^.]+)$/.exec(namaFile || '');
  return m ? m[1].toLowerCase() : '';
}

export const EKSTENSI_FOTO_VALID = ['jpg', 'jpeg', 'png'];

export function fotoValid(namaFile: string, mimeType: string): string | null {
  const ekst = ekstensiFile(namaFile);
  if (!EKSTENSI_FOTO_VALID.includes(ekst)) return `Format .${ekst || '?'} tidak didukung (hanya JPG, JPEG, PNG).`;
  if (mimeType && !['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType.toLowerCase())) {
    return `Tipe file ${mimeType} tidak didukung (hanya JPG, JPEG, PNG).`;
  }
  return null;
}

export interface PasanganFoto {
  fileName: string;
  kunci: string;
  cocokId: string | null;
  cocokNama: string | null;
  alasan: string | null;
}

/**
 * Cocokkan setiap nama file foto ke pengguna berdasarkan username ATAU ID
 * (case-insensitive, spasi/underscore/dash diabaikan). Username dicek dulu,
 * lalu ID. Satu pengguna tidak dipakai dua kali.
 */
export function cocokkanFotoMassal(
  namaFiles: string[],
  daftar: Pick<PenggunaData, 'id' | 'username' | 'nama'>[],
): PasanganFoto[] {
  const terpakai = new Set<string>();
  return namaFiles.map((fileName) => {
    const kunci = kunciDariNamaFile(fileName);
    if (!kunci) return { fileName, kunci, cocokId: null, cocokNama: null, alasan: 'Nama file kosong.' };
    const olehUsername = daftar.find(
      (u) => normalisasiKunci(u.username) === kunci && !terpakai.has(u.id),
    );
    if (olehUsername) {
      terpakai.add(olehUsername.id);
      return { fileName, kunci, cocokId: olehUsername.id, cocokNama: olehUsername.nama, alasan: null };
    }
    const olehId = daftar.find(
      (u) => normalisasiKunci(u.id) === kunci && !terpakai.has(u.id),
    );
    if (olehId) {
      terpakai.add(olehId.id);
      return { fileName, kunci, cocokId: olehId.id, cocokNama: olehId.nama, alasan: null };
    }
    return { fileName, kunci, cocokId: null, cocokNama: null, alasan: `Tidak ada pengguna dengan username atau ID "${kunci}".` };
  });
}

export interface BarisImporPengguna {
  nama: string;
  username: string;
  password: string;
  role: string;
  kelas: string;
  id: string;
  masalah: string[];
}

export const PERAN_VALID = ['Admin', 'Guru', 'Siswa', 'Pegawai', 'Operator'];

/** Validasi satu baris impor Excel (murni, tanpa efek samping). */
export function validasiBarisImpor(
  b: Omit<BarisImporPengguna, 'masalah'>,
  usernameAda: Set<string>,
): string[] {
  const masalah: string[] = [];
  if (!b.nama.trim()) masalah.push('Nama kosong');
  if (!b.username.trim()) masalah.push('Username kosong');
  else if (!/^[A-Za-z0-9._-]+$/.test(b.username.trim())) masalah.push('Username hanya boleh huruf, angka, titik, underscore, dash');
  else if (usernameAda.has(b.username.trim().toLowerCase())) masalah.push(`Username ${b.username.trim()} sudah ada`);
  if (!b.password) masalah.push('Password kosong');
  else if (b.password.length < 6) masalah.push('Password minimal 6 karakter');
  if (!PERAN_VALID.includes(b.role.trim())) masalah.push(`Role harus salah satu: ${PERAN_VALID.join(', ')}`);
  return masalah;
}

export interface StatistikDashboard {
  totalPengguna: number;
  totalSiswa: number;
  totalGuru: number;
  totalKelas: number;
  totalFoto: number;
  belumPunyaFoto: number;
  daftarKelas: string[];
}

/** Statistik dashboard — dihitung dari data live, tanpa asumsi kelas tetap. */
export function hitungStatistik(daftar: PenggunaData[]): StatistikDashboard {
  const kelasSet = new Set<string>();
  let totalSiswa = 0;
  let totalGuru = 0;
  let totalFoto = 0;
  for (const u of daftar) {
    if (u.role === 'Siswa') totalSiswa++;
    if (u.role === 'Guru') totalGuru++;
    if ((u.kelas || '').trim()) kelasSet.add(u.kelas.trim());
    if ((u.fotoUrl || '').trim()) totalFoto++;
  }
  return {
    totalPengguna: daftar.length,
    totalSiswa,
    totalGuru,
    totalKelas: kelasSet.size,
    totalFoto,
    belumPunyaFoto: daftar.length - totalFoto,
    daftarKelas: [...kelasSet].sort(),
  };
}

/**
 * Pilih template untuk satu pengguna: template default dengan roleTarget
 * sama persis dulu, lalu template default 'Semua', lalu template pertama.
 */
export function pilihTemplateUntukRole(
  templates: TemplateKartu[],
  role: string,
): TemplateKartu | null {
  if (!templates.length) return null;
  const perRole = templates.find((t) => t.isDefault && t.roleTarget === role);
  if (perRole) return perRole;
  const semua = templates.find((t) => t.isDefault && t.roleTarget === 'Semua');
  if (semua) return semua;
  return templates.find((t) => t.isDefault) || templates[0];
}

/** Filter + pencarian tabel pengguna (nama, username, kelas, ID). */
export function filterPengguna(
  daftar: PenggunaData[],
  kataKunci: string,
  filterRole: string,
  filterKelas: string,
): PenggunaData[] {
  const k = (kataKunci || '').trim().toLowerCase();
  return daftar.filter((u) => {
    if (filterRole && filterRole !== 'Semua' && u.role !== filterRole) return false;
    if (filterKelas && filterKelas !== 'Semua' && u.kelas !== filterKelas) return false;
    if (!k) return true;
    return (
      u.nama.toLowerCase().includes(k) ||
      u.username.toLowerCase().includes(k) ||
      (u.kelas || '').toLowerCase().includes(k) ||
      (u.id || '').toLowerCase().includes(k)
    );
  });
}

/** ID otomatis berikutnya: KID-0001, KID-0002, ... (tidak memakai ID yang sudah ada). */
export function idBerikutnya(daftar: Pick<PenggunaData, 'id'>[]): string {
  let maks = 0;
  for (const u of daftar) {
    const m = /^KID-(\d+)$/.exec((u.id || '').trim());
    if (m) maks = Math.max(maks, parseInt(m[1], 10) || 0);
  }
  return `KID-${String(maks + 1).padStart(4, '0')}`;
}

/** Bagi kartu ke halaman A4: kembalikan daftar halaman (array ID per halaman). */
export function bagiKeHalaman<T>(items: T[], kolom: number, baris: number): T[][] {
  const perHalaman = Math.max(1, kolom) * Math.max(1, baris);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += perHalaman) out.push(items.slice(i, i + perHalaman));
  return out;
}
