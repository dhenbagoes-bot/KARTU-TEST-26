# Manajemen Data & Cetak Kartu Identitas — wwn-kartu-identitas-80 v1.0.0

Aplikasi web **Manajemen Data Pengguna dan Cetak Kartu Identitas**: kelola data pengguna (Admin/Guru/Siswa/Pegawai/Operator), upload foto massal yang dicocokkan otomatis dari nama file, impor Excel ratusan data sekaligus, beberapa template kartu (mis. Kartu Siswa, Kartu Guru, Kartu Pegawai) dengan template default per role, dan cetak kartu 85 × 55 mm (individual/massal, per kelas, per role, ceklis) ke PDF lewat dialog cetak browser.

- **Stack:** React 19 + Vite + TypeScript + Tailwind 4, backend Google Apps Script + Google Sheets + Google Drive. **Bukan Firebase. Bukan localStorage sebagai database utama** — data tersimpan di Google Sheets (cloud); yang tersimpan di browser hanya URL backend + token sesi (7 hari).
- **Desain:** Modern Dashboard UI, dominasi Emerald Green + putih + aksen emas, sidebar berikon, responsif desktop/tablet/HP.

## Fitur

| Area | Isi |
|---|---|
| Login | Username + password, token sesi 7 hari. Admin akses penuh; Guru/Pegawai/Operator kelola data + cetak; Siswa hanya lihat/cetak kartunya sendiri. Password disimpan SHA-256 + garam — tidak pernah plaintext, tidak pernah dikirim ke frontend. |
| Dashboard | Total Pengguna, Total Siswa, Total Guru, Total Kelas (distinct), Total Foto Sudah Diunggah, Belum Punya Foto — semua dihitung dari data live — plus aktivitas terbaru & tombol cepat. |
| Data Pengguna | Tambah/edit/hapus (konfirmasi hapus), cari nama/username/kelas/ID, filter role & kelas, foto individual (pratinjau sebelum simpan; ganti foto minta konfirmasi), username unik (frontend + backend, case-insensitive), ID otomatis KID-0001 dst (atau isi manual). Ekspor Excel. |
| Upload Foto Massal | Pilih banyak file (JPG/JPEG/PNG saja — tipe lain ditolak dengan alasan), cocok otomatis dari nama file tanpa ekstensi ke Username ATAU ID (case-insensitive, `budi.jpg` / `KID-0001.png`), pratinjau + pasangan SEBELUM diproses, status per file berhasil/gagal + alasan, file tak cocok didaftar terpisah. Foto lama TIDAK ditimpa tanpa konfirmasi (mode timpa default MATI). Tanpa foto → inisial nama, bukan foto orang lain. |
| Impor Excel | Unduh template .xlsx (Nama\|Username\|Password\|Role\|Kelas\|ID) → unggah → pratinjau + validasi per baris → simpan baris valid. Username duplikat dilewati & dilaporkan; data lama tidak dihapus/ditimpa. |
| Desain Kartu + Template | Ukuran standar 85 × 55 mm, orientasi portrait/landscape, foto, Nama, Username/ID, Role, Kelas; logo instansi bisa diunggah & posisi diatur; warna/background/font/tata letak bisa disesuaikan; pratinjau langsung. Simpan BEBERAPA template bernama; template default per role otomatis dipakai saat cetak (bisa diganti manual). Buat/edit/hapus/duplikat template. |
| Cetak & Download | Cetak satu kartu, massal, per kelas, per role, ceklis pengguna tertentu; pengaturan kartu per lembar A4 (kolom × baris + jarak + garis potong); ukuran kartu akurat di cetak (@media print, mm persis); unduh PDF lewat dialog cetak browser (pilih *Save as PDF*, skala 100%, aktifkan *Background graphics*); tombol Tandai Sudah Dicetak. |
| Konfigurasi | Nama/alamat/kontak/kepala instansi, tahun, unggah logo; URL backend + Uji Koneksi + Inisialisasi Database. Halaman ini tetap bisa dibuka walau data gagal dimuat. |
| Backup & Restore | Unduh backup JSON lengkap; pulihkan dengan aman — hanya menambah yang belum ada (username/ID), tidak menimpa/menghapus data lama. |

## Akun bawaan (SEGERA GANTI!)

Dibuat **hanya saat sheet Pengguna masih kosong** oleh Inisialisasi Database:

- `admin` / `admin123` — peran Admin
- `operator` / `operator123` — peran Operator

> ⚠️ **Segera ganti kata sandi setelah login pertama** (Data Pengguna → Edit akun → isi Password baru). Kata sandi bawaan TIDAK ditampilkan di halaman login. Jangan biarkan akun bawaan aktif dengan kata sandi default.

## 1. Setup backend (sekali saja)

1. Buat **Google Spreadsheet baru** (mis. "Database Kartu Identitas"). Satu spreadsheet + satu Apps Script **per instansi**; instansi lain = spreadsheet lain.
2. Dari **DALAM spreadsheet itu**: menu **Extensions → Apps Script**.
   ⚠️ **JANGAN** buat project di `script.google.com` langsung (standalone) — `SpreadsheetApp.getActiveSpreadsheet()` akan `null` dan semua aksi gagal dengan error `Cannot read properties of null`.
3. **Hapus seluruh isi editor**, lalu **paste seluruh isi `backend/Kode.gs`**. Simpan.
4. Project Settings (ikon roda gigi) → centang **"Show appsscript.json manifest file in editor"**, lalu **ganti isi `appsscript.json`** dengan file `backend/appsscript.json` dari repo ini (izin Sheets + Drive diperlukan untuk unggah foto/logo).
5. Jalankan fungsi **`authorizeDriveAccess`** sekali dari editor, setujui izin Drive.
6. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Salin URL `/exec`.
   Setiap perubahan kode berikutnya: **Deploy → Manage deployments → New version** (BUKAN New deployment baru — kalau tidak, URL lama tetap menjalankan kode lama).
7. Di aplikasi: menu **Konfigurasi** → tempel URL `/exec` → **Uji Koneksi** → **Inisialisasi Database**.
8. Login dengan akun bawaan, **segera ganti kata sandi**, lalu isi identitas instansi & unggah logo di Konfigurasi.

## 2. Upload ke GitHub (web interface)

1. Buat repo baru di GitHub (mis. `wwn-kartu-identitas-80`).
2. **Add file → Upload files**, lalu seret **seluruh isi folder proyek**: `src/`, `public/`, `backend/`, `test/`, `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `vercel.json`.
   ⚠️ Jangan hanya mengunggah file lepas — `src/main.tsx` yang tertinggal membuat deploy Vercel gagal.
3. Commit dengan pesan `v1.0.0 — Manajemen Data & Cetak Kartu Identitas`.
4. Buka repo di browser dan **periksa pohon folder lengkap** sebelum deploy.

## 3. Deploy ke Vercel

1. Vercel → Add New → Project → import repo GitHub di atas.
2. Framework: **Vite** (terdeteksi otomatis). Build command `npm run build`, output `dist`.
3. Deploy. Buka URL hasil deploy, buka **Konfigurasi**, tempel URL backend, Uji Koneksi, Inisialisasi Database.
4. **Multi-instansi (opsional):** daftarkan tiap instansi di `public/schools.json` (`{ "id", "nama", "apiUrl" }`), lalu buka dengan `?school=<id>`. Jangan pernah menulis URL backend mentah di address bar — pakai `?school=`.

## 4. Cara pakai (ringkas)

1. **Impor Excel** — unduh template, isi ratusan baris, unggah, periksa pratinjau, simpan baris valid.
2. **Upload Foto Massal** — siapkan foto bernama `username.jpg` atau `KID-0001.png`, pilih banyak file, periksa pasangan, klik Proses.
3. **Desain Kartu** — pilih/buat template (Kartu Siswa/Guru/Pegawai), atur warna/font/orientasi, lihat pratinjau, simpan. Template default per role dipakai otomatis saat cetak.
4. **Cetak Kartu** — filter kelas/role atau ceklis pengguna, atur kolom × baris A4, **Cetak / Simpan PDF**, lalu **Tandai Sudah Dicetak**.
5. **Backup** — unduh backup JSON berkala.

## API backend (kontrak)

- POST JSON `{ action, token?, ...params }`, `Content-Type: text/plain`.
- Envelope SELALU `{ success, message?, data?, error? }`.
- Aksi: `ping`, `getAllData`, `login`, `logout`, `initDatabase`, `addPengguna`, `updatePengguna`, `deletePengguna`, `importPengguna`, `uploadFoto`, `uploadFotoMassal`, `getPengaturan`, `savePengaturan`, `uploadLogo`, `saveTemplate`, `deleteTemplate`, `listTemplate`, `backupData`, `restoreData`, `tandaiDicetak`.
- Sheet: `Pengguna` (ID, Nama, Username, PasswordHash, PasswordSalt, Role, Kelas, FotoUrl, Status, Dicetak, DibuatPada, DiubahPada), `Pengaturan` (Kunci, Nilai), `TemplateKartu` (ID, Nama, RoleTarget, DesainJson, IsDefault, DibuatPada, DiubahPada), `LogAktivitas`.
- `initDatabase` hanya membuat header/sheet kosong + seed bila kosong — **tidak pernah menghapus data**.

## QA (dijalankan sebelum rilis v1.0.0)

- `npx tsc --noEmit` — 0 error.
- `npm run build` — sukses (dist/index.html + bundle JS/CSS).
- `node --check` pada salinan `backend/Kode.gs` sebagai `.js` — lolos (Node 24 menolak ekstensi `.gs` untuk `--check`; isi file yang dicek identik).
- `node test/smoke-backend.mjs` — **74 lolos, 0 gagal** (semua aksi backend diuji dengan stub GAS).
- `node test/frontend-logic.test.cjs` — **47 lolos, 0 gagal** (pencocokan foto, validasi impor, statistik dashboard, template per role, filter, ID otomatis, halaman A4).

## Batasan yang jujur

- **Belum teruji klik live di situs** — QA di atas adalah type check, build, dan smoke test backend ber-stub + logika frontend. Uji klik di situs live (login, impor Excel, upload foto massal, cetak/PDF) adalah tugas pengguna setelah deploy; laporkan hasilnya bila ada yang gagal.
- **Foto & logo disimpan di Google Drive** milik akun deployer (folder "Kartu Identitas", dibagikan *Anyone with link — View* agar bisa tampil di kartu). Hapus file di Drive bila foto pengguna dihapus dari aplikasi — aplikasi tidak menghapus file Drive otomatis.
- **Restore backup tidak memulihkan password lama** — hash tidak dipulihkan; pengguna hasil restore mendapat password sementara acak dan **wajib direset oleh admin** (Data Pengguna → Edit → isi Password baru). Pesan ini juga muncul di hasil restore.
- **Ganti password mematikan semua token sesi pengguna itu** (wajib login ulang) — sengaja, demi keamanan.
- **Batas Apps Script:** unggah foto massal dikirim per batch dari frontend; file > ~5 MB ditolak. Untuk ratusan foto, unggah dalam beberapa batch bila koneksi lambat.
- **PDF dihasilkan lewat dialog cetak browser** (bukan library PDF) — pastikan skala 100% dan *Background graphics* aktif agar warna kartu dan ukuran 85 × 55 mm akurat.
- Identitas instansi default adalah placeholder netral **"Nama Instansi"** — isi sendiri di Konfigurasi; tidak ada nama madrasah/sekolah yang di-hardcode.
