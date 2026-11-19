import * as XLSX from 'xlsx';
import type { PenggunaData } from '../types';
import { validasiBarisImpor, type BarisImporPengguna } from './logika';

/** Header template Excel — urutan ini yang dibaca saat impor. */
export const HEADER_PENGGUNA = ['Nama', 'Username', 'Password', 'Role', 'Kelas', 'ID'];

export function unduhTemplatePengguna(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    HEADER_PENGGUNA,
    ['Budi Santoso', 'budi.santoso', 'rahasia123', 'Siswa', '9A', 'KID-0001'],
    ['Siti Aminah', 'siti.aminah', 'rahasia123', 'Guru', '', ''],
  ]);
  ws['!cols'] = HEADER_PENGGUNA.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pengguna');
  XLSX.writeFile(wb, 'template-pengguna-kartu-identitas.xlsx');
}

function sel(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    const y = v.getFullYear(); const m = String(v.getMonth() + 1).padStart(2, '0'); const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

/** Baca .xlsx/.csv -> baris terstruktur + masalah per baris (tanpa menyimpan apa pun). */
export async function bacaFileImpor(file: File, usernameAda: Set<string>): Promise<BarisImporPengguna[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const out: BarisImporPengguna[] = [];
  const terlihat = new Set<string>(usernameAda);
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.every((c) => sel(c) === '')) continue;
    const b: BarisImporPengguna = {
      nama: sel(r[0]), username: sel(r[1]), password: sel(r[2]),
      role: sel(r[3]) || 'Siswa', kelas: sel(r[4]), id: sel(r[5]), masalah: [],
    };
    b.masalah = validasiBarisImpor(b, terlihat);
    if (b.username) terlihat.add(b.username.toLowerCase());
    out.push(b);
  }
  return out;
}

export function eksporPenggunaExcel(daftar: PenggunaData[]): void {
  const rows = daftar.map((u) => [u.id, u.nama, u.username, u.role, u.kelas, u.fotoUrl ? 'Ada' : 'Belum', u.status, u.dicetak ? 'Sudah' : 'Belum']);
  const ws = XLSX.utils.aoa_to_sheet([['ID', 'Nama', 'Username', 'Role', 'Kelas', 'Foto', 'Status', 'Sudah Dicetak'], ...rows]);
  ws['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pengguna');
  XLSX.writeFile(wb, 'data-pengguna-kartu-identitas.xlsx');
}
