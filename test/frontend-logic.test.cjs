// Uji logika frontend (hasil kompilasi src/utils/*): pencocokan nama file foto,
// validasi impor Excel, statistik dashboard, pemilihan template per role,
// filter/pencarian, ID otomatis, pembagian halaman A4.
// Jalankan: node test/frontend-logic.test.cjs  (exit 0 = semua lolos)
// Kompilasi dulu:
//   npx tsc -p test/tsconfig.test.json
//   for f in test/dist-test-cjs/utils/*.js; do mv "$f" "${f%.js}.cjs"; done
//   sed -i 's#require("./logika")#require("./logika.cjs")#' test/dist-test-cjs/utils/excel.cjs
// (rename .js -> .cjs karena package.json bertipe "module")
const XLSX = require('xlsx');
const { bacaFileImpor, HEADER_PENGGUNA } = require('./dist-test-cjs/utils/excel.cjs');
const { fmtTanggal, fmtWaktu, validasiPenggunaForm } = require('./dist-test-cjs/utils/format.cjs');
const {
  cocokkanFotoMassal, fotoValid, kunciDariNamaFile, validasiBarisImpor,
  hitungStatistik, pilihTemplateUntukRole, filterPengguna, idBerikutnya,
  bagiKeHalaman,
} = require('./dist-test-cjs/utils/logika.cjs');

let lolos = 0, gagal = 0;
function cek(nama, kond, extra) {
  if (kond) { lolos++; console.log('  OK  ' + nama); }
  else { gagal++; console.log('  GAGAL ' + nama + ' ' + (extra || '')); }
}
function fileDariAoa(aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pengguna');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return { arrayBuffer: async () => buf };
}

const DAFTAR = [
  { id: 'KID-0001', username: 'budi.santoso', nama: 'Budi Santoso' },
  { id: 'KID-0002', username: 'siti.aminah', nama: 'Siti Aminah' },
  { id: 'GURU-01', username: 'agus.guru', nama: 'Agus Guru' },
];

async function main() {
  console.log('== pencocokan foto massal ==');
  cek('kunciDariNamaFile: budi.jpg -> budi', kunciDariNamaFile('budi.jpg') === 'budi');
  cek('kunciDariNamaFile: KID-0001.PNG -> kid0001 (dash diabaikan)', kunciDariNamaFile('KID-0001.PNG') === 'kid0001');
  const cocok = cocokkanFotoMassal(['budi.santoso.jpg', 'KID-0002.png', 'AGUS_GURU.jpeg', 'tidak-ada.jpg', 'budi.santoso.jpg'], DAFTAR);
  cek('cocok username (budi.santoso.jpg)', cocok[0].cocokId === 'KID-0001' && cocok[0].cocokNama === 'Budi Santoso');
  cek('cocok ID (KID-0002.png)', cocok[1].cocokId === 'KID-0002');
  cek('cocok case-insensitive + underscore diabaikan (AGUS_GURU.jpeg)', cocok[2].cocokId === 'GURU-01');
  cek('tidak cocok dilaporkan + alasan', cocok[3].cocokId === null && !!cocok[3].alasan);
  cek('satu pengguna tidak dipakai dua kali', cocok[4].cocokId === null);
  cek('fotoValid: jpg lolos', fotoValid('a.jpg', 'image/jpeg') === null);
  cek('fotoValid: png lolos', fotoValid('a.png', 'image/png') === null);
  cek('fotoValid: gif ditolak', fotoValid('a.gif', 'image/gif') !== null);
  cek('fotoValid: pdf ditolak', fotoValid('a.pdf', 'application/pdf') !== null);
  cek('fotoValid: tanpa ekstensi ditolak', fotoValid('tanpaekstensi', '') !== null);

  console.log('== validasi impor Excel ==');
  cek('header template 6 kolom Nama|Username|Password|Role|Kelas|ID', HEADER_PENGGUNA.length === 6 && HEADER_PENGGUNA.join('|') === 'Nama|Username|Password|Role|Kelas|ID');
  const ada = new Set(['budi.santoso']);
  cek('baris valid lolos', validasiBarisImpor({ nama: 'Andi', username: 'andi', password: 'rahasia123', role: 'Siswa', kelas: '9A', id: '' }, ada).length === 0);
  cek('username duplikat ditolak', validasiBarisImpor({ nama: 'X', username: 'BUDI.SANTOSO', password: 'rahasia123', role: 'Siswa', kelas: '', id: '' }, ada).length > 0);
  cek('password pendek ditolak', validasiBarisImpor({ nama: 'X', username: 'baru', password: '123', role: 'Siswa', kelas: '', id: '' }, ada).length > 0);
  cek('role invalid ditolak', validasiBarisImpor({ nama: 'X', username: 'baru', password: 'rahasia123', role: 'Kepala', kelas: '', id: '' }, ada).length > 0);
  cek('nama kosong ditolak', validasiBarisImpor({ nama: '', username: 'baru', password: 'rahasia123', role: 'Siswa', kelas: '', id: '' }, ada).length > 0);

  const rows = await bacaFileImpor(fileDariAoa([
    HEADER_PENGGUNA,
    ['Andi Wijaya', 'andi', 'rahasia123', 'Siswa', '9A', ''],
    ['Budi Lain', 'budi.santoso', 'rahasia123', 'Siswa', '9A', ''],
    ['Rina', 'rina', 'abc', 'Guru', '', ''],
    ['', '', '', '', '', ''],
  ]), new Set(['budi.santoso']));
  cek('baca impor: baris kosong dilewati (3 baris)', rows.length === 3, 'jumlah=' + rows.length);
  cek('baris valid tanpa masalah', rows[0].masalah.length === 0 && rows[0].nama === 'Andi Wijaya');
  cek('duplikat di file impor terdeteksi', rows[1].masalah.some((m) => m.includes('sudah ada')));
  cek('password pendek di file impor terdeteksi', rows[2].masalah.some((m) => m.includes('Password')));

  console.log('== statistik dashboard ==');
  const stat = hitungStatistik([
    { role: 'Siswa', kelas: '9A', fotoUrl: 'x' },
    { role: 'Siswa', kelas: '9A', fotoUrl: '' },
    { role: 'Siswa', kelas: '9B', fotoUrl: '' },
    { role: 'Guru', kelas: '', fotoUrl: 'x' },
    { role: 'Admin', kelas: '', fotoUrl: '' },
  ]);
  cek('total pengguna 5', stat.totalPengguna === 5);
  cek('total siswa 3', stat.totalSiswa === 3);
  cek('total guru 1', stat.totalGuru === 1);
  cek('total kelas 2 (distinct, kosong diabaikan)', stat.totalKelas === 2 && stat.daftarKelas.join(',') === '9A,9B');
  cek('total foto 2, belum punya foto 3', stat.totalFoto === 2 && stat.belumPunyaFoto === 3);
  cek('statistik kosong = semua nol', hitungStatistik([]).totalPengguna === 0 && hitungStatistik([]).belumPunyaFoto === 0);

  console.log('== template per role ==');
  const templates = [
    { id: 't1', nama: 'Kartu Siswa', roleTarget: 'Siswa', isDefault: true, desain: {} },
    { id: 't2', nama: 'Kartu Guru', roleTarget: 'Guru', isDefault: true, desain: {} },
    { id: 't3', nama: 'Umum', roleTarget: 'Semua', isDefault: true, desain: {} },
  ];
  cek('Siswa -> Kartu Siswa', pilihTemplateUntukRole(templates, 'Siswa')?.id === 't1');
  cek('Guru -> Kartu Guru', pilihTemplateUntukRole(templates, 'Guru')?.id === 't2');
  cek('Pegawai (tanpa template khusus) -> Umum', pilihTemplateUntukRole(templates, 'Pegawai')?.id === 't3');
  cek('tanpa template -> null', pilihTemplateUntukRole([], 'Siswa') === null);

  console.log('== filter, ID, halaman ==');
  const daftar = [
    { id: 'KID-0001', nama: 'Budi Santoso', username: 'budi.santoso', role: 'Siswa', kelas: '9A', fotoUrl: '', status: 'aktif', dicetak: 0, dibuatPada: '', diubahPada: '' },
    { id: 'KID-0002', nama: 'Siti Aminah', username: 'siti.aminah', role: 'Guru', kelas: '', fotoUrl: '', status: 'aktif', dicetak: 0, dibuatPada: '', diubahPada: '' },
    { id: 'KID-0003', nama: 'Andi Wijaya', username: 'andi', role: 'Siswa', kelas: '9B', fotoUrl: '', status: 'aktif', dicetak: 0, dibuatPada: '', diubahPada: '' },
  ];
  cek('cari nama (budi)', filterPengguna(daftar, 'budi', 'Semua', 'Semua').length === 1);
  cek('cari username (andi)', filterPengguna(daftar, 'andi', 'Semua', 'Semua').length === 1);
  cek('cari ID (KID-0002)', filterPengguna(daftar, 'KID-0002', 'Semua', 'Semua').length === 1);
  cek('cari kelas (9B)', filterPengguna(daftar, '9b', 'Semua', 'Semua').length === 1);
  cek('filter role Siswa = 2', filterPengguna(daftar, '', 'Siswa', 'Semua').length === 2);
  cek('filter kelas 9A = 1', filterPengguna(daftar, '', 'Semua', '9A').length === 1);
  cek('ID berikutnya KID-0004', idBerikutnya(daftar) === 'KID-0004');
  cek('ID berikutnya dari kosong = KID-0001', idBerikutnya([]) === 'KID-0001');
  cek('ID berikutnya melewati ID manual non-KID', idBerikutnya([{ id: 'GURU-01' }, { id: 'KID-0002' }]) === 'KID-0003');
  cek('bagi halaman 2x4: 10 kartu -> 2 halaman (8+2)', (() => { const h = bagiKeHalaman([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2, 4); return h.length === 2 && h[0].length === 8 && h[1].length === 2; })());
  cek('fmtTanggal', fmtTanggal('2013-05-10') === '10/05/2013');
  cek('fmtWaktu', fmtWaktu('2026-11-19 13:00:00') === '19/11/2026 13:00');
  cek('validasi form: data benar lolos', validasiPenggunaForm({ nama: 'Budi', username: 'budi', password: 'rahasia123', role: 'Siswa', isBaru: true }).length === 0);
  cek('validasi form: username ber-spasi ditolak', validasiPenggunaForm({ nama: 'Budi', username: 'budi santoso', password: 'rahasia123', role: 'Siswa', isBaru: true }).length > 0);
  cek('ukuran kartu: rasio 85/55 = 1,545', Math.abs(85 / 55 - 1.545) < 0.001);

  console.log('\nHASIL: ' + lolos + ' lolos, ' + gagal + ' gagal');
  process.exit(gagal ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
