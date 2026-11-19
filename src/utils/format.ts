export function fmtTanggal(iso: string): string {
  if (!iso) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

export function fmtWaktu(dt: string): string {
  if (!dt) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(dt);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  return dt;
}

/** Baca file gambar -> { dataUrl, mimeType } untuk pratinjau sebelum simpan. */
export function bacaGambar(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('File harus berupa gambar.')); return; }
    if (file.size > 5 * 1024 * 1024) { reject(new Error('Ukuran gambar maksimal 5 MB.')); return; }
    const r = new FileReader();
    r.onload = () => resolve({ dataUrl: String(r.result), mimeType: file.type });
    r.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    r.readAsDataURL(file);
  });
}

export function unduhTeks(namaFile: string, isi: string, tipe = 'application/json'): void {
  const blob = new Blob([isi], { type: tipe });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = namaFile; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function validasiPenggunaForm(s: { nama: string; username: string; password: string; role: string; isBaru: boolean }): string[] {
  const errs: string[] = [];
  if (!s.nama.trim()) errs.push('Nama lengkap wajib diisi.');
  if (!s.username.trim()) errs.push('Username wajib diisi.');
  else if (!/^[A-Za-z0-9._-]+$/.test(s.username.trim())) errs.push('Username hanya boleh huruf, angka, titik, underscore, dash.');
  if (s.isBaru && (!s.password || s.password.length < 6)) errs.push('Password wajib diisi, minimal 6 karakter.');
  if (s.password && s.password.length < 6) errs.push('Password minimal 6 karakter.');
  if (!['Admin', 'Guru', 'Siswa', 'Pegawai', 'Operator'].includes(s.role)) errs.push('Role tidak valid.');
  return errs;
}
